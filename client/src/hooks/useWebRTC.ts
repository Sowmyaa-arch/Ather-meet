import { useState, useRef, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { IceServer } from '../types';

interface WebRTCProps {
  socket: Socket | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  iceServers: IceServer[];
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useWebRTC({ socket, localStream, screenStream, iceServers }: WebRTCProps) {
  // Remote streams mapped by peer socketId
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [connectionStates, setConnectionStates] = useState<Map<string, RTCIceConnectionState>>(new Map());

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const screenStreamRef = useRef<MediaStream | null>(screenStream);

  // Keep stream refs updated
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

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
          console.warn(`Error adding queued ICE candidate for ${peerId}:`, err);
        }
      }
    }
    candidateQueuesRef.current.set(peerId, []);
  }, []);

  // Create an RTCPeerConnection instance for a peer
  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      // Return existing if already created
      if (peerConnectionsRef.current.has(peerId)) {
        return peerConnectionsRef.current.get(peerId)!;
      }

      const activeIceServers = iceServers && iceServers.length > 0 ? iceServers : DEFAULT_ICE_SERVERS;

      const rtcConfig: RTCConfiguration = {
        iceServers: activeIceServers,
        iceCandidatePoolSize: 10,
      };

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionsRef.current.set(peerId, pc);
      candidateQueuesRef.current.set(peerId, []);

      // Add transceivers upfront so SDP always includes sendrecv audio and video channels
      const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
      const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });

      // Add active local tracks if available immediately
      const activeStream = screenStreamRef.current || localStreamRef.current;
      if (activeStream) {
        const audioTrack = activeStream.getAudioTracks()[0];
        if (audioTrack && audioTransceiver.sender) {
          audioTransceiver.sender.replaceTrack(audioTrack).catch(err => {
            console.warn(`Error setting initial audio track for ${peerId}:`, err);
          });
        }

        const videoTrack = activeStream.getVideoTracks()[0];
        if (videoTrack && videoTransceiver.sender) {
          videoTransceiver.sender.replaceTrack(videoTrack).catch(err => {
            console.warn(`Error setting initial video track for ${peerId}:`, err);
          });
        }
      }

      // Handle ICE Candidate generation
      pc.onicecandidate = event => {
        if (event.candidate && socket) {
          socket.emit('signal-ice-candidate', {
            targetSocketId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle Remote Stream reception (combines audio and video tracks without overwriting)
      pc.ontrack = event => {
        setRemoteStreams(prev => {
          const existing = prev.get(peerId);
          let stream: MediaStream;

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

      // Handle Connection State changes
      pc.oniceconnectionstatechange = () => {
        setConnectionStates(prev => {
          const updated = new Map(prev);
          updated.set(peerId, pc.iceConnectionState);
          return updated;
        });
      };

      return pc;
    },
    [iceServers, socket]
  );

  // Close and cleanup a specific peer connection
  const closePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
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

  // Close all peer connections (e.g. on leaving meeting)
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
        const pc = createPeerConnection(peerId);
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
        console.error(`Error initiating offer to ${peerId}:`, err);
      }
    },
    [createPeerConnection, socket]
  );

  // Setup Socket signaling listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Participant Joined: Initiate connection offer to them
    const handleParticipantJoined = async (participant: { socketId: string }) => {
      await initiateOffer(participant.socketId);
    };

    // 2. Incoming Offer: Set remote description, create and send answer
    const handleSignalOffer = async ({ senderSocketId, offer }: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
      try {
        const pc = createPeerConnection(senderSocketId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await processCandidateQueue(senderSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('signal-answer', {
          targetSocketId: senderSocketId,
          answer,
        });
      } catch (err) {
        console.error(`Error handling offer from ${senderSocketId}:`, err);
      }
    };

    // 3. Incoming Answer: Set remote description
    const handleSignalAnswer = async ({ senderSocketId, answer }: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      try {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processCandidateQueue(senderSocketId);
        }
      } catch (err) {
        console.error(`Error handling answer from ${senderSocketId}:`, err);
      }
    };

    // 4. Incoming ICE Candidate: Add or queue
    const handleSignalIceCandidate = async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(senderSocketId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(`Error adding ICE candidate from ${senderSocketId}:`, err);
        }
      } else {
        // Queue candidate until remote description is applied
        const queue = candidateQueuesRef.current.get(senderSocketId) || [];
        queue.push(candidate);
        candidateQueuesRef.current.set(senderSocketId, queue);
      }
    };

    // 5. Participant Left: Clean up their connection
    const handleParticipantLeft = ({ socketId }: { socketId: string }) => {
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
  }, [closePeerConnection, createPeerConnection, initiateOffer, processCandidateQueue, socket]);

  // Seamless track replacement for screen sharing, camera toggle, or microphone reacquisition
  useEffect(() => {
    const videoTrack = screenStream?.getVideoTracks()[0] || localStream?.getVideoTracks()[0] || null;
    const audioTrack = localStream?.getAudioTracks()[0] || null;

    peerConnectionsRef.current.forEach(pc => {
      // 1. Video sender / transceiver replacement
      const transceivers = pc.getTransceivers();
      const videoTransceiver = transceivers.find(
        t => t.sender.track?.kind === 'video' || t.receiver.track.kind === 'video'
      );

      if (videoTransceiver) {
        videoTransceiver.sender.replaceTrack(videoTrack).catch(err => {
          console.warn('Error replacing video track:', err);
        });
      } else if (videoTrack) {
        try {
          const activeStream = screenStreamRef.current || localStreamRef.current;
          if (activeStream) {
            pc.addTrack(videoTrack, activeStream);
          }
        } catch (err) {
          console.warn('Error adding video track to peer connection:', err);
        }
      }

      // 2. Audio sender / transceiver replacement
      const audioTransceiver = transceivers.find(
        t => t.sender.track?.kind === 'audio' || t.receiver.track.kind === 'audio'
      );

      if (audioTransceiver) {
        audioTransceiver.sender.replaceTrack(audioTrack).catch(err => {
          console.warn('Error replacing audio track:', err);
        });
      } else if (audioTrack) {
        try {
          if (localStreamRef.current) {
            pc.addTrack(audioTrack, localStreamRef.current);
          }
        } catch (err) {
          console.warn('Error adding audio track to peer connection:', err);
        }
      }
    });
  }, [screenStream, localStream]);

  return {
    remoteStreams,
    connectionStates,
    initiateOffer,
    closePeerConnection,
    closeAllConnections,
  };
}
