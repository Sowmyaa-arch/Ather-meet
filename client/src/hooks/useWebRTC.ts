import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { IceServer } from '../types';

interface WebRTCProps {
  socket: Socket | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  iceServers: IceServer[];
}

// Last-resort fallback used only if the server sends no iceServers.
// These are STUN-only — they cannot relay traffic through firewalls.
// For cross-NAT reliability, set METERED_API_KEY + METERED_DOMAIN on Render
// so /api/ice-servers returns TURN credentials.
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export function useWebRTC({ socket, localStream, screenStream, iceServers }: WebRTCProps) {
  // Remote streams mapped by peer socketId
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionStates, setConnectionStates] = useState<Map<string, RTCIceConnectionState>>(new Map());

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const screenStreamRef = useRef<MediaStream | null>(screenStream);

  // Helper to attach local tracks to a peer connection
  const attachTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    const senders = pc.getSenders();
    stream.getTracks().forEach(track => {
      const existingSender = senders.find(s => s.track && s.track.kind === track.kind);
      if (existingSender) {
        existingSender.replaceTrack(track).catch(err => {
          console.warn(`[WebRTC] replaceTrack error for ${track.kind}:`, err);
        });
      } else {
        try {
          pc.addTrack(track, stream);
        } catch (err) {
          console.warn(`[WebRTC] addTrack error for ${track.kind}:`, err);
        }
      }
    });
  }, []);

  // Keep stream refs updated and sync to active peer connections
  useEffect(() => {
    localStreamRef.current = localStream;
    if (localStream) {
      peerConnectionsRef.current.forEach(pc => {
        attachTracks(pc, localStream);
      });
    }
  }, [localStream, attachTracks]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
    if (screenStream) {
      peerConnectionsRef.current.forEach(pc => {
        attachTracks(pc, screenStream);
      });
    }
  }, [screenStream, attachTracks]);

  // Method to immediately provide media stream before React state render
  const setLocalMediaStream = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;
    if (stream) {
      peerConnectionsRef.current.forEach(pc => {
        attachTracks(pc, stream);
      });
    }
  }, [attachTracks]);

  // Flush queued ICE candidates after remote description is set
  const processCandidateQueue = useCallback(async (peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    const queue = candidateQueuesRef.current.get(peerId) || [];
    if (!pc || !pc.remoteDescription) return;

    while (queue.length > 0) {
      const candidate = queue.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[WebRTC] Error adding queued candidate for ${peerId}:`, err);
        }
      }
    }
    candidateQueuesRef.current.set(peerId, []);
  }, []);

  // Create an RTCPeerConnection instance for a peer
  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      if (peerConnectionsRef.current.has(peerId)) {
        return peerConnectionsRef.current.get(peerId)!;
      }

      console.log(`[WebRTC] Creating RTCPeerConnection for peer ${peerId}`);
      const activeIceServers = iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;

      const pc = new RTCPeerConnection({
        iceServers: activeIceServers,
        iceCandidatePoolSize: 10,
      });

      peerConnectionsRef.current.set(peerId, pc);
      candidateQueuesRef.current.set(peerId, []);

      // Attach any available local tracks immediately
      const activeStream = screenStreamRef.current || localStreamRef.current;
      if (activeStream && activeStream.getTracks().length > 0) {
        attachTracks(pc, activeStream);
      }

      // Log ICE Candidate types to confirm STUN/TURN usage
      // candidate.type: 'host' = local, 'srflx' = STUN, 'relay' = TURN
      pc.onicecandidate = event => {
        if (event.candidate && socket) {
          const c = event.candidate;
          console.log(
            `[ICE] Local candidate for ${peerId}: type=${c.type ?? 'unknown'} protocol=${c.protocol ?? '?'} address=${c.address ?? '?'}`
          );
          socket.emit('signal-ice-candidate', {
            targetSocketId: peerId,
            candidate: c.toJSON(),
          });
        } else if (!event.candidate) {
          console.log(`[ICE] Candidate gathering complete for ${peerId}`);
        }
      };

      // Log gathering state changes
      pc.onicegatheringstatechange = () => {
        console.log(`[ICE] Gathering state for ${peerId}: ${pc.iceGatheringState}`);
      };

      // Log ICE errors (useful to detect TURN credential failures)
      pc.onicecandidateerror = (event) => {
        const e = event as RTCPeerConnectionIceErrorEvent;
        // errorCode 701 = TURN credential error, 701+ = server error
        if (e.errorCode !== 701) {
          console.warn(
            `[ICE] Candidate error for ${peerId}: code=${e.errorCode} url=${e.url} text=${e.errorText}`
          );
        }
      };

      // Handle Remote Stream reception
      pc.ontrack = event => {
        console.log(`[WebRTC] Received remote track (${event.track.kind}) from ${peerId}`);
        setRemoteStreams(prev => {
          let stream: MediaStream;
          const existing = prev.get(peerId);

          if (event.streams && event.streams[0]) {
            stream = event.streams[0];
          } else if (existing) {
            if (!existing.getTracks().some(t => t.id === event.track.id)) {
              existing.addTrack(event.track);
            }
            stream = existing;
          } else {
            stream = new MediaStream([event.track]);
          }

          const updated = new Map(prev);
          updated.set(peerId, stream);
          return updated;
        });
      };

      // Handle Connection State changes — both ICE and overall connection
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log(`[ICE] Peer ${peerId} ICE connection state: ${state}`);
        setConnectionStates(prev => {
          const updated = new Map(prev);
          updated.set(peerId, state);
          return updated;
        });

        if (state === 'failed') {
          console.warn(`[ICE] Connection FAILED for ${peerId} — attempting ICE restart`);
          pc.restartIce();
        } else if (state === 'connected' || state === 'completed') {
          // Log the selected candidate pair to confirm if relay (TURN) is being used
          pc.getStats().then(stats => {
            stats.forEach(report => {
              if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) {
                const localCandId = report.localCandidateId;
                const remoteCandId = report.remoteCandidateId;
                stats.forEach(r => {
                  if (r.id === localCandId) {
                    console.log(`[ICE] ✅ Selected LOCAL candidate: type=${r.candidateType} protocol=${r.protocol} address=${r.address}`);
                  }
                  if (r.id === remoteCandId) {
                    console.log(`[ICE] ✅ Selected REMOTE candidate: type=${r.candidateType} protocol=${r.protocol} address=${r.address}`);
                  }
                });
              }
            });
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[ICE] Peer ${peerId} overall connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'failed') {
          console.warn(`[ICE] Overall connection FAILED for ${peerId} — closing`);
        }
      };

      return pc;
    },
    [iceServers, socket, attachTracks]
  );

  // Close and cleanup a specific peer connection
  const closePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onicegatheringstatechange = null;
      pc.onicecandidateerror = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    candidateQueuesRef.current.delete(peerId);

    setRemoteStreams(prev => {
      const updated = new Map(prev);
      updated.delete(peerId);
      return updated;
    });

    setConnectionStates(prev => {
      const updated = new Map(prev);
      updated.delete(peerId);
      return updated;
    });
  }, []);

  // Close all peer connections
  const closeAllConnections = useCallback(() => {
    peerConnectionsRef.current.forEach((_, peerId) => {
      closePeerConnection(peerId);
    });
    peerConnectionsRef.current.clear();
    candidateQueuesRef.current.clear();
    setRemoteStreams(new Map());
    setConnectionStates(new Map());
  }, [closePeerConnection]);

  // Initiate an offer to a newly discovered peer
  const initiateOffer = useCallback(
    async (peerId: string) => {
      if (!socket) return;
      try {
        console.log(`[WebRTC] Initiating offer to peer ${peerId}`);
        const pc = createPeerConnection(peerId);

        // Ensure tracks are attached before creating offer
        const activeStream = screenStreamRef.current || localStreamRef.current;
        if (activeStream && activeStream.getTracks().length > 0) {
          attachTracks(pc, activeStream);
        }

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);

        socket.emit('signal-offer', {
          targetSocketId: peerId,
          offer,
        });
      } catch (err) {
        console.error(`[WebRTC] Error initiating offer to ${peerId}:`, err);
      }
    },
    [createPeerConnection, socket, attachTracks]
  );

  // Setup Socket signaling listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Participant Joined: Initiate connection offer to them
    const handleParticipantJoined = async (participant: { socketId: string }) => {
      console.log(`[WebRTC] Participant joined room: ${participant.socketId}`);
      await initiateOffer(participant.socketId);
    };

    // 2. Incoming Offer: Set remote description, attach local tracks, send answer
    const handleSignalOffer = async ({
      senderSocketId,
      offer,
    }: {
      senderSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      try {
        console.log(`[WebRTC] Received offer from ${senderSocketId}`);
        const pc = createPeerConnection(senderSocketId);

        // Handle collision / polite peer
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' } as any).catch(() => {});
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processCandidateQueue(senderSocketId);

        // Attach local tracks to answer
        const activeStream = screenStreamRef.current || localStreamRef.current;
        if (activeStream && activeStream.getTracks().length > 0) {
          attachTracks(pc, activeStream);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('signal-answer', {
          targetSocketId: senderSocketId,
          answer,
        });
      } catch (err) {
        console.error(`[WebRTC] Error handling offer from ${senderSocketId}:`, err);
      }
    };

    // 3. Incoming Answer: Set remote description
    const handleSignalAnswer = async ({
      senderSocketId,
      answer,
    }: {
      senderSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      try {
        console.log(`[WebRTC] Received answer from ${senderSocketId}`);
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processCandidateQueue(senderSocketId);
        }
      } catch (err) {
        console.error(`[WebRTC] Error handling answer from ${senderSocketId}:`, err);
      }
    };

    // 4. Incoming ICE Candidate: Add or queue
    const handleSignalIceCandidate = async ({
      senderSocketId,
      candidate,
    }: {
      senderSocketId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionsRef.current.get(senderSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`[WebRTC] Error adding ICE candidate from ${senderSocketId}:`, err);
        }
      } else {
        const queue = candidateQueuesRef.current.get(senderSocketId) || [];
        queue.push(candidate);
        candidateQueuesRef.current.set(senderSocketId, queue);
      }
    };

    // 5. Participant Left: Clean up their connection
    const handleParticipantLeft = ({ socketId }: { socketId: string }) => {
      console.log(`[WebRTC] Participant left: ${socketId}`);
      closePeerConnection(socketId);
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('signal-offer', handleSignalOffer);
    socket.on('signal-answer', handleSignalAnswer);
    socket.on('signal-ice-candidate', handleSignalIceCandidate);
    socket.on('participant-left', handleParticipantLeft);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('signal-offer', handleSignalOffer);
      socket.off('signal-answer', handleSignalAnswer);
      socket.off('signal-ice-candidate', handleSignalIceCandidate);
      socket.off('participant-left', handleParticipantLeft);
    };
  }, [closePeerConnection, createPeerConnection, initiateOffer, processCandidateQueue, socket, attachTracks]);

  return {
    remoteStreams,
    connectionStates,
    setLocalMediaStream,
    initiateOffer,
    closePeerConnection,
    closeAllConnections,
  };
}
