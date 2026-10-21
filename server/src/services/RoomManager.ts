import { MeetingRoomState, ParticipantState, WaitingParticipant, InternalPoll, PollData } from '../types/index.js';

class RoomManager {
  private rooms: Map<string, MeetingRoomState> = new Map();
  // Reverse lookup: socketId -> meetingId
  private socketToRoom: Map<string, string> = new Map();

  public getOrCreateRoom(
    meetingId: string,
    initialData: {
      title: string;
      hostUserId: string;
      isLocked?: boolean;
      waitingRoomEnabled?: boolean;
    }
  ): MeetingRoomState {
    let room = this.rooms.get(meetingId);
    if (!room) {
      room = {
        meetingId,
        title: initialData.title,
        hostUserId: initialData.hostUserId,
        isLocked: initialData.isLocked ?? false,
        waitingRoomEnabled: initialData.waitingRoomEnabled ?? false,
        guestCameraBlocked: false,
        participants: new Map(),
        waitingParticipants: new Map(),
        polls: new Map(),
        createdAt: new Date(),
      };
      this.rooms.set(meetingId, room);
    }
    return room;
  }

  public getRoom(meetingId: string): MeetingRoomState | undefined {
    return this.rooms.get(meetingId);
  }

  public addParticipant(meetingId: string, participant: ParticipantState): void {
    const room = this.rooms.get(meetingId);
    if (room) {
      if (room.guestCameraBlocked && participant.role !== 'HOST') {
        participant.isCameraBlocked = true;
        participant.isVideoOff = true;
      }
      room.participants.set(participant.socketId, participant);
      this.socketToRoom.set(participant.socketId, meetingId);
    }
  }

  public removeParticipant(
    meetingId: string,
    socketId: string
  ): { removed?: ParticipantState; roomEmpty: boolean } {
    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(meetingId);
    if (!room) {
      return { roomEmpty: true };
    }

    const removed = room.participants.get(socketId);
    room.participants.delete(socketId);

    const roomEmpty = room.participants.size === 0 && room.waitingParticipants.size === 0;
    if (roomEmpty) {
      this.rooms.delete(meetingId);
    }

    return { removed, roomEmpty };
  }

  public addWaitingParticipant(meetingId: string, waiting: WaitingParticipant): void {
    const room = this.rooms.get(meetingId);
    if (room) {
      room.waitingParticipants.set(waiting.socketId, waiting);
      this.socketToRoom.set(waiting.socketId, meetingId);
    }
  }

  public removeWaitingParticipant(
    meetingId: string,
    socketId: string
  ): WaitingParticipant | undefined {
    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const waiting = room.waitingParticipants.get(socketId);
    room.waitingParticipants.delete(socketId);

    if (room.participants.size === 0 && room.waitingParticipants.size === 0) {
      this.rooms.delete(meetingId);
    }

    return waiting;
  }

  public updateParticipantState(
    meetingId: string,
    socketId: string,
    updates: Partial<ParticipantState>
  ): ParticipantState | undefined {
    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (!participant) return undefined;

    const updated = { ...participant, ...updates };
    room.participants.set(socketId, updated);
    return updated;
  }

  public setRoomLock(meetingId: string, isLocked: boolean): boolean {
    const room = this.rooms.get(meetingId);
    if (!room) return false;
    room.isLocked = isLocked;
    return true;
  }

  public setWaitingRoom(meetingId: string, enabled: boolean): boolean {
    const room = this.rooms.get(meetingId);
    if (!room) return false;
    room.waitingRoomEnabled = enabled;
    return true;
  }

  public setParticipantCameraBlocked(
    meetingId: string,
    socketId: string,
    isBlocked: boolean
  ): ParticipantState | undefined {
    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (!participant) return undefined;

    participant.isCameraBlocked = isBlocked;
    if (isBlocked) {
      participant.isVideoOff = true;
    }
    return participant;
  }

  public setRoomGuestCameraBlocked(meetingId: string, isBlocked: boolean): boolean {
    const room = this.rooms.get(meetingId);
    if (!room) return false;

    room.guestCameraBlocked = isBlocked;
    for (const p of room.participants.values()) {
      if (p.role !== 'HOST') {
        p.isCameraBlocked = isBlocked;
        if (isBlocked) {
          p.isVideoOff = true;
        }
      }
    }
    return true;
  }

  public findParticipantBySocketId(
    socketId: string
  ): { meetingId: string; participant: ParticipantState } | undefined {
    const meetingId = this.socketToRoom.get(socketId);
    if (!meetingId) return undefined;

    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const participant = room.participants.get(socketId);
    if (!participant) return undefined;

    return { meetingId, participant };
  }

  public findWaitingBySocketId(
    socketId: string
  ): { meetingId: string; waiting: WaitingParticipant } | undefined {
    const meetingId = this.socketToRoom.get(socketId);
    if (!meetingId) return undefined;

    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const waiting = room.waitingParticipants.get(socketId);
    if (!waiting) return undefined;

    return { meetingId, waiting };
  }

  public getParticipantsList(meetingId: string): ParticipantState[] {
    const room = this.rooms.get(meetingId);
    if (!room) return [];
    return Array.from(room.participants.values());
  }

  public getWaitingList(meetingId: string): WaitingParticipant[] {
    const room = this.rooms.get(meetingId);
    if (!room) return [];
    return Array.from(room.waitingParticipants.values());
  }

  public closeRoom(meetingId: string): void {
    const room = this.rooms.get(meetingId);
    if (room) {
      for (const socketId of room.participants.keys()) {
        this.socketToRoom.delete(socketId);
      }
      for (const socketId of room.waitingParticipants.keys()) {
        this.socketToRoom.delete(socketId);
      }
      this.rooms.delete(meetingId);
    }
  }

  // -----------------------------------------------------------------
  // POLL MANAGEMENT
  // -----------------------------------------------------------------

  public createPoll(
    meetingId: string,
    pollData: {
      id: string;
      question: string;
      options: { id: string; text: string }[];
      createdBy: string;
      creatorName: string;
    }
  ): InternalPoll | undefined {
    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const poll: InternalPoll = {
      id: pollData.id,
      meetingId,
      question: pollData.question,
      options: pollData.options.map(o => ({ id: o.id, text: o.text, votes: 0 })),
      createdBy: pollData.createdBy,
      creatorName: pollData.creatorName,
      createdAt: new Date().toISOString(),
      isActive: true,
      voters: new Map(),
    };

    room.polls.set(poll.id, poll);
    return poll;
  }

  public votePoll(
    meetingId: string,
    pollId: string,
    voterId: string,
    optionId: string
  ): InternalPoll | undefined {
    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const poll = room.polls.get(pollId);
    if (!poll || !poll.isActive) return undefined;

    // Prevent duplicate voting
    if (poll.voters.has(voterId)) return undefined;

    const option = poll.options.find(o => o.id === optionId);
    if (!option) return undefined;

    option.votes++;
    poll.voters.set(voterId, optionId);
    return poll;
  }

  public closePoll(meetingId: string, pollId: string): InternalPoll | undefined {
    const room = this.rooms.get(meetingId);
    if (!room) return undefined;

    const poll = room.polls.get(pollId);
    if (!poll) return undefined;

    poll.isActive = false;
    return poll;
  }

  public getPolls(meetingId: string): InternalPoll[] {
    const room = this.rooms.get(meetingId);
    if (!room) return [];
    return Array.from(room.polls.values());
  }

  public serializePoll(poll: InternalPoll, viewerSocketId?: string): PollData {
    const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
    return {
      id: poll.id,
      meetingId: poll.meetingId,
      question: poll.question,
      options: poll.options.map(o => ({ id: o.id, text: o.text, votes: o.votes })),
      createdBy: poll.createdBy,
      creatorName: poll.creatorName,
      createdAt: poll.createdAt,
      isActive: poll.isActive,
      totalVotes,
      userVotedOptionId: viewerSocketId ? poll.voters.get(viewerSocketId) : undefined,
    };
  }

  public getStats() {
    return {
      activeRooms: this.rooms.size,
      totalParticipants: Array.from(this.rooms.values()).reduce(
        (acc, r) => acc + r.participants.size,
        0
      ),
    };
  }
}

export const roomManager = new RoomManager();
