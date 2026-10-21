export type ParticipantRole = 'HOST' | 'PARTICIPANT';

export interface ParticipantState {
  socketId: string;
  peerId: string;
  userId?: string;
  displayName: string;
  role: ParticipantRole;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isCameraBlocked?: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: string;
}

export interface WaitingParticipant {
  socketId: string;
  userId?: string;
  displayName: string;
  requestedAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollData {
  id: string;
  meetingId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  creatorName: string;
  createdAt: string;
  isActive: boolean;
  totalVotes: number;
  userVotedOptionId?: string;
}

export interface InternalPoll {
  id: string;
  meetingId: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  creatorName: string;
  createdAt: string;
  isActive: boolean;
  voters: Map<string, string>; // socketId or userId -> optionId
}

export interface MeetingRoomState {
  meetingId: string;
  title: string;
  hostUserId: string;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  guestCameraBlocked?: boolean;
  participants: Map<string, ParticipantState>;
  waitingParticipants: Map<string, WaitingParticipant>;
  polls: Map<string, InternalPoll>;
  createdAt: Date;
}

export interface ChatMessageData {
  id: string;
  meetingId: string;
  senderSocketId: string;
  senderUserId?: string;
  senderName: string;
  content: string;
  timestamp: string;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}
