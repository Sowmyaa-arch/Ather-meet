export type ParticipantRole = 'HOST' | 'PARTICIPANT';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface Participant {
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
  stream?: MediaStream;
  connectionState?: RTCIceConnectionState;
}

export interface WaitingParticipant {
  socketId: string;
  userId?: string;
  displayName: string;
  requestedAt: string;
}

export interface ChatMessage {
  id: string;
  meetingId: string;
  senderSocketId: string;
  senderUserId?: string;
  senderName: string;
  content: string;
  timestamp: string;
  isSelf?: boolean;
}

export interface MeetingDetails {
  id: string;
  title: string;
  host: {
    id: string;
    name: string;
    email: string;
  };
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  participantCount?: number;
  isHost?: boolean;
  endedAt?: string | null;
  createdAt?: string;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  xOffset: number;
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
