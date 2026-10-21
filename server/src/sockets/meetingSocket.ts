import { Server, Socket } from 'socket.io';
import { prisma } from '../utils/prisma.js';
import { verifyToken, sanitizeText } from '../utils/security.js';
import { roomManager } from '../services/RoomManager.js';
import { socketRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/index.js';
import { ParticipantState } from '../types/index.js';

interface JoinPayload {
  meetingId: string;
  displayName: string;
  token?: string;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
}

export function registerMeetingSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    // -------------------------------------------------------------
    // JOIN MEETING
    // -------------------------------------------------------------
    socket.on('join-meeting', async (payload: JoinPayload) => {
      try {
        const { meetingId, displayName, token, isAudioMuted = false, isVideoOff = false } = payload;

        if (!meetingId || !displayName) {
          socket.emit('meeting-error', { message: 'Meeting ID and display name are required' });
          return;
        }

        // Verify meeting in Database
        const meeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
        });

        if (!meeting) {
          socket.emit('meeting-error', { message: 'Meeting not found or invalid meeting ID' });
          return;
        }

        if (meeting.endedAt) {
          socket.emit('meeting-error', { message: 'This meeting has already ended' });
          return;
        }

        // Check authentication if token provided
        let user: { userId: string; email: string; name: string } | null = null;
        if (token) {
          user = verifyToken(token);
        }

        const isHost = Boolean(user && user.userId === meeting.hostId);

        // Ensure room is registered in RoomManager
        const room = roomManager.getOrCreateRoom(meetingId, {
          title: meeting.title,
          hostUserId: meeting.hostId,
          isLocked: meeting.isLocked,
          waitingRoomEnabled: meeting.waitingRoomEnabled,
        });

        // Room Lock Check
        if (room.isLocked && !isHost) {
          socket.emit('meeting-error', { message: 'This meeting is currently locked by the host' });
          return;
        }

        // Waiting Room Check
        if (room.waitingRoomEnabled && !isHost) {
          roomManager.addWaitingParticipant(meetingId, {
            socketId: socket.id,
            userId: user?.userId,
            displayName,
            requestedAt: new Date().toISOString(),
          });

          socket.emit('waiting-room-status', {
            inWaitingRoom: true,
            message: 'Waiting for the host to admit you into the meeting...',
          });

          // Notify host(s)
          io.to(`meeting:${meetingId}`).emit(
            'waiting-participants-updated',
            roomManager.getWaitingList(meetingId)
          );
          return;
        }

        // Add to active room participants
        const participant: ParticipantState = {
          socketId: socket.id,
          peerId: socket.id,
          userId: user?.userId,
          displayName,
          role: isHost ? 'HOST' : 'PARTICIPANT',
          isAudioMuted: Boolean(isAudioMuted),
          isVideoOff: Boolean(isVideoOff),
          isScreenSharing: false,
          isHandRaised: false,
          joinedAt: new Date().toISOString(),
        };

        roomManager.addParticipant(meetingId, participant);
        socket.join(`meeting:${meetingId}`);

        // Get existing peers in the room (excluding joining user)
        const existingParticipants = roomManager
          .getParticipantsList(meetingId)
          .filter(p => p.socketId !== socket.id);

        // Acknowledge join to current socket
        socket.emit('meeting-joined', {
          meetingId,
          title: room.title,
          participantId: socket.id,
          role: participant.role,
          isLocked: room.isLocked,
          waitingRoomEnabled: room.waitingRoomEnabled,
          guestCameraBlocked: room.guestCameraBlocked || false,
          isCameraBlocked: participant.isCameraBlocked || false,
          participants: existingParticipants,
          iceServers: config.iceServers,
        });

        // Broadcast to other participants in this meeting
        socket.to(`meeting:${meetingId}`).emit('participant-joined', participant);

        // If host joined, send current waiting list if any
        if (isHost) {
          socket.emit('waiting-participants-updated', roomManager.getWaitingList(meetingId));
        }

        // Record participant entry in DB asynchronously
        prisma.meetingParticipant
          .create({
            data: {
              meetingId,
              userId: user?.userId || null,
              guestName: user ? null : displayName,
              role: participant.role,
            },
          })
          .catch(err => console.error('Error logging participant:', err));
      } catch (err: any) {
        console.error('Error in join-meeting:', err);
        socket.emit('meeting-error', { message: 'Failed to join meeting' });
      }
    });

    // -------------------------------------------------------------
    // WEBRTC SIGNALING: OFFER, ANSWER, ICE CANDIDATES (ROOM ISOLATED)
    // -------------------------------------------------------------
    socket.on('signal-offer', ({ targetSocketId, offer }: { targetSocketId: string; offer: any }) => {
      const senderInfo = roomManager.findParticipantBySocketId(socket.id);
      const targetInfo = roomManager.findParticipantBySocketId(targetSocketId);

      // Room isolation check: both must belong to the exact same meeting!
      if (!senderInfo || !targetInfo || senderInfo.meetingId !== targetInfo.meetingId) {
        return;
      }

      io.to(targetSocketId).emit('signal-offer', {
        senderSocketId: socket.id,
        offer,
      });
    });

    socket.on('signal-answer', ({ targetSocketId, answer }: { targetSocketId: string; answer: any }) => {
      const senderInfo = roomManager.findParticipantBySocketId(socket.id);
      const targetInfo = roomManager.findParticipantBySocketId(targetSocketId);

      // Room isolation check
      if (!senderInfo || !targetInfo || senderInfo.meetingId !== targetInfo.meetingId) {
        return;
      }

      io.to(targetSocketId).emit('signal-answer', {
        senderSocketId: socket.id,
        answer,
      });
    });

    socket.on('signal-ice-candidate', ({ targetSocketId, candidate }: { targetSocketId: string; candidate: any }) => {
      const senderInfo = roomManager.findParticipantBySocketId(socket.id);
      const targetInfo = roomManager.findParticipantBySocketId(targetSocketId);

      // Room isolation check
      if (!senderInfo || !targetInfo || senderInfo.meetingId !== targetInfo.meetingId) {
        return;
      }

      io.to(targetSocketId).emit('signal-ice-candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // -------------------------------------------------------------
    // MEDIA STATE UPDATES (Mic, Camera, Screen Share)
    // -------------------------------------------------------------
    socket.on('update-media-state', (updates: { isAudioMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }) => {
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      // Prevent unmuting camera if host has blocked camera access for this user
      if (info.participant.isCameraBlocked && updates.isVideoOff === false) {
        updates.isVideoOff = true;
        socket.emit('camera-blocked', { message: 'Camera access has been disabled by the meeting host.' });
      }

      const updated = roomManager.updateParticipantState(info.meetingId, socket.id, updates);
      if (updated) {
        io.to(`meeting:${info.meetingId}`).emit('participant-media-changed', {
          socketId: socket.id,
          isAudioMuted: updated.isAudioMuted,
          isVideoOff: updated.isVideoOff,
          isScreenSharing: updated.isScreenSharing,
        });
      }
    });

    // -------------------------------------------------------------
    // IN-MEETING TEXT CHAT (Rate-limited, Sanitized, Room Isolated)
    // -------------------------------------------------------------
    socket.on('send-chat-message', async ({ content }: { content: string }) => {
      // Rate limit check
      if (!socketRateLimiter.isAllowed(socket.id, 'chat', 5)) {
        socket.emit('chat-error', { message: 'You are sending messages too quickly' });
        return;
      }

      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      const trimmed = (content || '').trim();
      if (!trimmed || trimmed.length > 2000) return;

      const sanitized = sanitizeText(trimmed);
      const messageData = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        meetingId: info.meetingId,
        senderSocketId: socket.id,
        senderUserId: info.participant.userId,
        senderName: info.participant.displayName,
        content: sanitized,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to all participants in this room only
      io.to(`meeting:${info.meetingId}`).emit('chat-message-received', messageData);

      // Persist in DB
      prisma.chatMessage
        .create({
          data: {
            meetingId: info.meetingId,
            userId: info.participant.userId || null,
            senderName: info.participant.displayName,
            content: sanitized,
          },
        })
        .catch(err => console.error('Error persisting message:', err));
    });

    // -------------------------------------------------------------
    // IN-MEETING REACTIONS & RAISE HAND
    // -------------------------------------------------------------
    socket.on('send-reaction', ({ emoji }: { emoji: string }) => {
      if (!socketRateLimiter.isAllowed(socket.id, 'reaction', 8)) return;
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      io.to(`meeting:${info.meetingId}`).emit('reaction-received', {
        socketId: socket.id,
        senderName: info.participant.displayName,
        emoji,
      });
    });

    socket.on('toggle-raise-hand', ({ isHandRaised }: { isHandRaised: boolean }) => {
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      const updated = roomManager.updateParticipantState(info.meetingId, socket.id, {
        isHandRaised: Boolean(isHandRaised),
      });

      if (updated) {
        io.to(`meeting:${info.meetingId}`).emit('raise-hand-changed', {
          socketId: socket.id,
          isHandRaised: updated.isHandRaised,
        });
      }
    });

    // -------------------------------------------------------------
    // HOST ACTIONS: ADMIT, REJECT, MUTE, REMOVE, LOCK, END
    // -------------------------------------------------------------
    socket.on('admit-participant', ({ targetSocketId }: { targetSocketId: string }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      const room = roomManager.getRoom(hostInfo.meetingId);
      if (!room) return;

      const waiting = roomManager.removeWaitingParticipant(hostInfo.meetingId, targetSocketId);
      if (!waiting) return;

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) return;

      const newParticipant: ParticipantState = {
        socketId: targetSocketId,
        peerId: targetSocketId,
        userId: waiting.userId,
        displayName: waiting.displayName,
        role: 'PARTICIPANT',
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
      };

      roomManager.addParticipant(hostInfo.meetingId, newParticipant);
      targetSocket.join(`meeting:${hostInfo.meetingId}`);

      const existingParticipants = roomManager
        .getParticipantsList(hostInfo.meetingId)
        .filter(p => p.socketId !== targetSocketId);

      // Inform target that they are admitted
      targetSocket.emit('meeting-admitted', {
        meetingId: hostInfo.meetingId,
        title: room.title,
        participantId: targetSocketId,
        role: 'PARTICIPANT',
        isLocked: room.isLocked,
        waitingRoomEnabled: room.waitingRoomEnabled,
        guestCameraBlocked: room.guestCameraBlocked || false,
        isCameraBlocked: newParticipant.isCameraBlocked || false,
        participants: existingParticipants,
        iceServers: config.iceServers,
      });

      // Broadcast new participant to others
      targetSocket.to(`meeting:${hostInfo.meetingId}`).emit('participant-joined', newParticipant);

      // Update host's waiting list
      socket.emit('waiting-participants-updated', roomManager.getWaitingList(hostInfo.meetingId));
    });

    socket.on('reject-participant', ({ targetSocketId }: { targetSocketId: string }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      roomManager.removeWaitingParticipant(hostInfo.meetingId, targetSocketId);
      io.to(targetSocketId).emit('meeting-rejected', {
        message: 'The host denied your request to join this meeting.',
      });

      socket.emit('waiting-participants-updated', roomManager.getWaitingList(hostInfo.meetingId));
    });

    socket.on('mute-participant', ({ targetSocketId }: { targetSocketId: string }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      io.to(targetSocketId).emit('force-mute');
      const updated = roomManager.updateParticipantState(hostInfo.meetingId, targetSocketId, {
        isAudioMuted: true,
      });
      if (updated) {
        io.to(`meeting:${hostInfo.meetingId}`).emit('participant-media-changed', {
          socketId: targetSocketId,
          isAudioMuted: true,
          isVideoOff: updated.isVideoOff,
          isScreenSharing: updated.isScreenSharing,
        });
      }
    });

    socket.on('block-participant-camera', ({ targetSocketId }: { targetSocketId: string }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      const updated = roomManager.setParticipantCameraBlocked(hostInfo.meetingId, targetSocketId, true);
      if (updated) {
        io.to(targetSocketId).emit('camera-blocked', {
          message: 'Your camera access has been blocked by the host.',
        });
        io.to(`meeting:${hostInfo.meetingId}`).emit('participant-camera-block-changed', {
          socketId: targetSocketId,
          isCameraBlocked: true,
          isVideoOff: true,
        });
      }
    });

    socket.on('unblock-participant-camera', ({ targetSocketId }: { targetSocketId: string }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      const updated = roomManager.setParticipantCameraBlocked(hostInfo.meetingId, targetSocketId, false);
      if (updated) {
        io.to(targetSocketId).emit('camera-unblocked', {
          message: 'The host has unblocked your camera access.',
        });
        io.to(`meeting:${hostInfo.meetingId}`).emit('participant-camera-block-changed', {
          socketId: targetSocketId,
          isCameraBlocked: false,
          isVideoOff: updated.isVideoOff,
        });
      }
    });

    socket.on('toggle-room-camera-block', ({ isBlocked }: { isBlocked: boolean }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      roomManager.setRoomGuestCameraBlocked(hostInfo.meetingId, isBlocked);
      const room = roomManager.getRoom(hostInfo.meetingId);
      if (room) {
        for (const [sid, p] of room.participants) {
          if (p.role !== 'HOST') {
            if (isBlocked) {
              io.to(sid).emit('camera-blocked', {
                message: 'The host has blocked camera access for all guests in this room.',
              });
            } else {
              io.to(sid).emit('camera-unblocked', {
                message: 'The host has enabled camera access for guests.',
              });
            }
          }
        }
      }

      io.to(`meeting:${hostInfo.meetingId}`).emit('room-camera-block-changed', {
        guestCameraBlocked: isBlocked,
        participants: roomManager.getParticipantsList(hostInfo.meetingId),
      });
    });

    socket.on('remove-participant', ({ targetSocketId }: { targetSocketId: string }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      io.to(targetSocketId).emit('removed-from-meeting', {
        message: 'You have been removed from the meeting by the host.',
      });

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(`meeting:${hostInfo.meetingId}`);
      }

      roomManager.removeParticipant(hostInfo.meetingId, targetSocketId);
      io.to(`meeting:${hostInfo.meetingId}`).emit('participant-left', { socketId: targetSocketId });
    });

    socket.on('toggle-lock-room', ({ isLocked }: { isLocked: boolean }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      roomManager.setRoomLock(hostInfo.meetingId, isLocked);
      io.to(`meeting:${hostInfo.meetingId}`).emit('room-lock-changed', { isLocked });

      prisma.meeting
        .update({
          where: { id: hostInfo.meetingId },
          data: { isLocked },
        })
        .catch(err => console.error('Error updating meeting lock in DB:', err));
    });

    socket.on('toggle-waiting-room', ({ enabled }: { enabled: boolean }) => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      roomManager.setWaitingRoom(hostInfo.meetingId, enabled);
      io.to(`meeting:${hostInfo.meetingId}`).emit('waiting-room-changed', { enabled });

      prisma.meeting
        .update({
          where: { id: hostInfo.meetingId },
          data: { waitingRoomEnabled: enabled },
        })
        .catch(err => console.error('Error updating waiting room in DB:', err));
    });

    socket.on('end-meeting-for-everyone', async () => {
      const hostInfo = roomManager.findParticipantBySocketId(socket.id);
      if (!hostInfo || hostInfo.participant.role !== 'HOST') return;

      io.to(`meeting:${hostInfo.meetingId}`).emit('meeting-ended', {
        message: 'The host has ended this meeting for all participants.',
      });

      roomManager.closeRoom(hostInfo.meetingId);

      await prisma.meeting
        .update({
          where: { id: hostInfo.meetingId },
          data: { endedAt: new Date() },
        })
        .catch(err => console.error('Error ending meeting in DB:', err));
    });

    // -------------------------------------------------------------
    // IN-MEETING POLLS (Host creates, participants vote)
    // -------------------------------------------------------------
    socket.on('create-poll', ({ question, options }: { question: string; options: string[] }) => {
      if (!socketRateLimiter.isAllowed(socket.id, 'poll', 3)) return;
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      // Only hosts can create polls
      if (info.participant.role !== 'HOST') {
        socket.emit('poll-error', { message: 'Only the host can create polls' });
        return;
      }

      const trimmedQ = (question || '').trim();
      if (!trimmedQ || trimmedQ.length > 500) return;
      if (!options || !Array.isArray(options) || options.length < 2 || options.length > 10) return;

      const sanitizedOptions = options
        .map(o => (o || '').trim())
        .filter(o => o.length > 0 && o.length <= 200);
      if (sanitizedOptions.length < 2) return;

      const pollId = `poll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const pollOptions = sanitizedOptions.map((text, idx) => ({
        id: `opt-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        text,
      }));

      const poll = roomManager.createPoll(info.meetingId, {
        id: pollId,
        question: trimmedQ,
        options: pollOptions,
        createdBy: socket.id,
        creatorName: info.participant.displayName,
      });

      if (poll) {
        // Broadcast to all participants in the room, with per-viewer vote tracking
        const room = roomManager.getRoom(info.meetingId);
        if (room) {
          for (const [sid] of room.participants) {
            const targetSocket = io.sockets.sockets.get(sid);
            if (targetSocket) {
              targetSocket.emit('poll-created', roomManager.serializePoll(poll, sid));
            }
          }
        }
      }
    });

    socket.on('vote-poll', ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      if (!socketRateLimiter.isAllowed(socket.id, 'pollvote', 5)) return;
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      const updatedPoll = roomManager.votePoll(info.meetingId, pollId, socket.id, optionId);
      if (updatedPoll) {
        // Broadcast updated poll to all participants with per-viewer vote tracking
        const room = roomManager.getRoom(info.meetingId);
        if (room) {
          for (const [sid] of room.participants) {
            const targetSocket = io.sockets.sockets.get(sid);
            if (targetSocket) {
              targetSocket.emit('poll-updated', roomManager.serializePoll(updatedPoll, sid));
            }
          }
        }
      } else {
        socket.emit('poll-error', { message: 'Could not vote. You may have already voted or the poll is closed.' });
      }
    });

    socket.on('close-poll', ({ pollId }: { pollId: string }) => {
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info || info.participant.role !== 'HOST') return;

      const closedPoll = roomManager.closePoll(info.meetingId, pollId);
      if (closedPoll) {
        const room = roomManager.getRoom(info.meetingId);
        if (room) {
          for (const [sid] of room.participants) {
            const targetSocket = io.sockets.sockets.get(sid);
            if (targetSocket) {
              targetSocket.emit('poll-updated', roomManager.serializePoll(closedPoll, sid));
            }
          }
        }
      }
    });

    socket.on('get-polls', () => {
      const info = roomManager.findParticipantBySocketId(socket.id);
      if (!info) return;

      const polls = roomManager.getPolls(info.meetingId);
      const serialized = polls.map(p => roomManager.serializePoll(p, socket.id));
      socket.emit('polls-list', serialized);
    });

    // -------------------------------------------------------------
    // DISCONNECTION & CLEANUP
    // -------------------------------------------------------------
    socket.on('leave-meeting', () => {
      handleSocketDisconnect(socket, io);
    });

    socket.on('disconnect', () => {
      handleSocketDisconnect(socket, io);
      socketRateLimiter.cleanup(socket.id);
    });
  });
}

function handleSocketDisconnect(socket: Socket, io: Server): void {
  // Check if participant was active in a room
  const participantInfo = roomManager.findParticipantBySocketId(socket.id);
  if (participantInfo) {
    const { meetingId } = participantInfo;
    socket.leave(`meeting:${meetingId}`);
    roomManager.removeParticipant(meetingId, socket.id);

    // Broadcast participant left to remaining peers
    io.to(`meeting:${meetingId}`).emit('participant-left', { socketId: socket.id });
    return;
  }

  // Check if participant was in waiting room
  const waitingInfo = roomManager.findWaitingBySocketId(socket.id);
  if (waitingInfo) {
    const { meetingId } = waitingInfo;
    roomManager.removeWaitingParticipant(meetingId, socket.id);
    io.to(`meeting:${meetingId}`).emit(
      'waiting-participants-updated',
      roomManager.getWaitingList(meetingId)
    );
  }
}
