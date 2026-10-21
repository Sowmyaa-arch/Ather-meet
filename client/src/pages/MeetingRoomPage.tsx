import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Copy,
  Check,
  Shield,
  Clock,
  Wifi,
  Lock,
  DoorClosed,
  AlertTriangle,
  Sparkles,
  VideoOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { useAuth } from '../context/AuthContext';
import { useMediaDevices } from '../hooks/useMediaDevices';
import { useWebRTC } from '../hooks/useWebRTC';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { getSocket, disconnectSocket } from '../services/socket';
import { Participant, WaitingParticipant, ChatMessage, IceServer, PollData } from '../types';

import { VideoGrid } from '../components/VideoGrid';
import { MeetingControls } from '../components/MeetingControls';
import { ChatDrawer } from '../components/ChatDrawer';
import { ParticipantsDrawer } from '../components/ParticipantsDrawer';
import { PollDrawer } from '../components/PollDrawer';
import { DeviceSettingsModal } from '../components/DeviceSettingsModal';
import { LeaveConfirmationModal } from '../components/LeaveConfirmationModal';

export const MeetingRoomPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Stored preferences from PreJoin
  const initialDisplayName =
    sessionStorage.getItem('aethermeet_display_name') || user?.name || 'Guest User';
  const initialMuted = sessionStorage.getItem('aethermeet_audio_muted') === 'true';
  const initialVideoOff = sessionStorage.getItem('aethermeet_video_off') === 'true';

  // Room State
  const [meetingTitle, setMeetingTitle] = useState('Meeting Room');
  const [isHost, setIsHost] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [waitingRoomMessage, setWaitingRoomMessage] = useState('Waiting for the host to admit you...');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingParticipant[]>([]);
  const [iceServers, setIceServers] = useState<IceServer[]>([]);
  const [meetingDuration, setMeetingDuration] = useState(0);

  // Host Camera Blocking State
  const [isCameraBlocked, setIsCameraBlocked] = useState(false);
  const [guestCameraBlocked, setGuestCameraBlocked] = useState(false);
  const [cameraBlockedNotice, setCameraBlockedNotice] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatError, setChatError] = useState<string | null>(null);

  // UI Panels State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isPollsOpen, setIsPollsOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMediaPrompt, setShowMediaPrompt] = useState(true);

  // Reaction Emojis
  const [reactions, setReactions] = useState<Map<string, string>>(new Map());

  // Poll State
  const [polls, setPolls] = useState<PollData[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);

  // Socket reference
  const socketRef = useRef(getSocket());

  // Media Devices Hook
  const {
    localStream,
    screenStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    permissionError,
    audioLevel,
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    setSelectedAudioInput,
    setSelectedVideoInput,
    setSelectedAudioOutput,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    setIsAudioMuted,
    setIsVideoOff,
    startScreenShare,
    stopScreenShare,
  } = useMediaDevices({
    autoStart: false,
    initialAudioMuted: initialMuted,
    initialVideoOff: initialVideoOff,
    displayName: initialDisplayName,
  });

  // WebRTC Hook
  const { remoteStreams, closeAllConnections } = useWebRTC({
    socket: socketRef.current,
    localStream,
    screenStream,
    iceServers,
  });

  // Duration Timer
  useEffect(() => {
    if (isInWaitingRoom) return;
    const timer = setInterval(() => {
      setMeetingDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isInWaitingRoom]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard Shortcuts Hook
  useKeyboardShortcuts({
    onToggleMic: toggleAudio,
    onToggleVideo: () => {
      if (isCameraBlocked) {
        setCameraBlockedNotice('Camera access has been disabled by the meeting host.');
        setTimeout(() => setCameraBlockedNotice(null), 4000);
        return;
      }
      toggleVideo();
    },
    onToggleChat: () => {
      setIsChatOpen(prev => {
        if (!prev) setUnreadCount(0);
        return !prev;
      });
      setIsParticipantsOpen(false);
    },
    onToggleParticipants: () => {
      setIsParticipantsOpen(prev => !prev);
      setIsChatOpen(false);
    },
    onCloseModals: () => {
      setIsChatOpen(false);
      setIsParticipantsOpen(false);
      setIsSettingsOpen(false);
      setIsLeaveModalOpen(false);
    },
  });

  // Initialize Media and Socket Connection
  useEffect(() => {
    let isCancelled = false;
    const socket = socketRef.current;

    async function initCall() {
      // 1. Capture local media stream
      const stream = await startMedia();
      if (isCancelled) return;

      // Apply initial muted / video off states
      if (initialMuted) {
        setIsAudioMuted(true);
        if (stream) {
          stream.getAudioTracks().forEach(t => (t.enabled = false));
        }
      }
      if (initialVideoOff) {
        setIsVideoOff(true);
        if (stream) {
          stream.getVideoTracks().forEach(t => (t.enabled = false));
        }
      }

      // 2. Connect Socket and Join Meeting
      if (!socket.connected) {
        socket.connect();
      }

      socket.emit('join-meeting', {
        meetingId,
        displayName: initialDisplayName,
        token: token || undefined,
        isAudioMuted: initialMuted,
        isVideoOff: initialVideoOff,
      });
    }

    initCall();

    // -------------------------------------------------------------
    // Socket Event Handlers
    // -------------------------------------------------------------
    const handleMeetingJoined = (data: any) => {
      setIsInWaitingRoom(false);
      setMeetingTitle(data.title);
      setIsHost(data.role === 'HOST');
      setIsLocked(data.isLocked);
      setWaitingRoomEnabled(data.waitingRoomEnabled);
      setGuestCameraBlocked(data.guestCameraBlocked || false);
      if (data.isCameraBlocked) {
        setIsCameraBlocked(true);
        setIsVideoOff(true);
      }
      setIceServers(data.iceServers || []);
      setParticipants(data.participants || []);
    };

    const handleWaitingRoomStatus = (data: any) => {
      setIsInWaitingRoom(data.inWaitingRoom);
      if (data.message) setWaitingRoomMessage(data.message);
    };

    const handleMeetingAdmitted = (data: any) => {
      setIsInWaitingRoom(false);
      setMeetingTitle(data.title);
      setIsHost(data.role === 'HOST');
      setIsLocked(data.isLocked);
      setWaitingRoomEnabled(data.waitingRoomEnabled);
      setGuestCameraBlocked(data.guestCameraBlocked || false);
      if (data.isCameraBlocked) {
        setIsCameraBlocked(true);
        setIsVideoOff(true);
      }
      setIceServers(data.iceServers || []);
      setParticipants(data.participants || []);
    };

    const handleMeetingRejected = (data: any) => {
      alert(data.message || 'You were not admitted to this meeting.');
      stopMedia();
      closeAllConnections();
      disconnectSocket();
      navigate('/ended');
    };

    const handleParticipantJoined = (participant: Participant) => {
      setParticipants(prev => {
        if (prev.some(p => p.socketId === participant.socketId)) return prev;
        return [...prev, participant];
      });
    };

    const handleParticipantLeft = ({ socketId }: { socketId: string }) => {
      setParticipants(prev => prev.filter(p => p.socketId !== socketId));
      setReactions(prev => {
        const updated = new Map(prev);
        updated.delete(socketId);
        return updated;
      });
    };

    const handleParticipantMediaChanged = (data: {
      socketId: string;
      isAudioMuted?: boolean;
      isVideoOff?: boolean;
      isScreenSharing?: boolean;
    }) => {
      setParticipants(prev =>
        prev.map(p => {
          if (p.socketId === data.socketId) {
            return {
              ...p,
              ...(data.isAudioMuted !== undefined ? { isAudioMuted: data.isAudioMuted } : {}),
              ...(data.isVideoOff !== undefined ? { isVideoOff: data.isVideoOff } : {}),
              ...(data.isScreenSharing !== undefined ? { isScreenSharing: data.isScreenSharing } : {}),
            };
          }
          return p;
        })
      );
    };

    const handleRaiseHandChanged = (data: { socketId: string; isHandRaised: boolean }) => {
      setParticipants(prev =>
        prev.map(p => (p.socketId === data.socketId ? { ...p, isHandRaised: data.isHandRaised } : p))
      );
    };

    const handleWaitingParticipantsUpdated = (list: WaitingParticipant[]) => {
      setWaitingList(list || []);
    };

    const handleForceMute = () => {
      toggleAudio();
    };

    const handleRemovedFromMeeting = (data: any) => {
      alert(data.message || 'You have been removed from the meeting by the host.');
      stopMedia();
      closeAllConnections();
      disconnectSocket();
      navigate('/ended');
    };

    const handleMeetingEnded = (data: any) => {
      alert(data.message || 'The host has ended this meeting.');
      stopMedia();
      closeAllConnections();
      disconnectSocket();
      navigate('/ended');
    };

    const handleRoomLockChanged = ({ isLocked }: { isLocked: boolean }) => {
      setIsLocked(isLocked);
    };

    const handleWaitingRoomChanged = ({ enabled }: { enabled: boolean }) => {
      setWaitingRoomEnabled(enabled);
    };

    const handleChatMessageReceived = (messageData: ChatMessage) => {
      const isSelf = messageData.senderSocketId === socket.id;
      setMessages(prev => [...prev, { ...messageData, isSelf }]);
      if (!isSelf && !isChatOpen) {
        setUnreadCount(prev => prev + 1);
      }
    };

    const handleChatError = ({ message }: { message: string }) => {
      setChatError(message);
      setTimeout(() => setChatError(null), 4000);
    };

    const handleReactionReceived = ({ socketId, emoji }: { socketId: string; emoji: string }) => {
      setReactions(prev => {
        const updated = new Map(prev);
        updated.set(socketId, emoji);
        return updated;
      });

      // Trigger celebratory confetti burst on 🎉 or 🚀
      if (emoji === '🎉' || emoji === '🚀') {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      }

      setTimeout(() => {
        setReactions(prev => {
          const updated = new Map(prev);
          updated.delete(socketId);
          return updated;
        });
      }, 2500);
    };

    const handleMeetingError = (data: any) => {
      alert(data.message || 'Meeting error encountered');
      navigate('/dashboard');
    };

    socket.on('meeting-joined', handleMeetingJoined);
    socket.on('waiting-room-status', handleWaitingRoomStatus);
    socket.on('meeting-admitted', handleMeetingAdmitted);
    socket.on('meeting-rejected', handleMeetingRejected);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('participant-media-changed', handleParticipantMediaChanged);
    socket.on('raise-hand-changed', handleRaiseHandChanged);
    socket.on('waiting-participants-updated', handleWaitingParticipantsUpdated);
    socket.on('force-mute', handleForceMute);
    socket.on('removed-from-meeting', handleRemovedFromMeeting);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('room-lock-changed', handleRoomLockChanged);
    socket.on('waiting-room-changed', handleWaitingRoomChanged);
    socket.on('chat-message-received', handleChatMessageReceived);
    socket.on('chat-error', handleChatError);
    socket.on('reaction-received', handleReactionReceived);
    socket.on('meeting-error', handleMeetingError);

    // Poll event handlers
    const handlePollCreated = (pollData: PollData) => {
      setPolls(prev => {
        if (prev.some(p => p.id === pollData.id)) return prev;
        return [...prev, pollData];
      });
    };

    const handlePollUpdated = (pollData: PollData) => {
      setPolls(prev => prev.map(p => p.id === pollData.id ? pollData : p));
    };

    const handlePollsList = (list: PollData[]) => {
      setPolls(list || []);
    };

    const handlePollError = ({ message }: { message: string }) => {
      setPollError(message);
      setTimeout(() => setPollError(null), 4000);
    };

    const handleCameraBlocked = (data: any) => {
      setIsCameraBlocked(true);
      setIsVideoOff(true);
      setCameraBlockedNotice(data.message || 'Your camera access has been blocked by the host.');
      setTimeout(() => setCameraBlockedNotice(null), 5000);
    };

    const handleCameraUnblocked = (data: any) => {
      setIsCameraBlocked(false);
      setCameraBlockedNotice(data.message || 'The host has unblocked your camera access.');
      setTimeout(() => setCameraBlockedNotice(null), 4000);
    };

    const handleParticipantCameraBlockChanged = (data: { socketId: string; isCameraBlocked: boolean; isVideoOff: boolean }) => {
      setParticipants(prev =>
        prev.map(p =>
          p.socketId === data.socketId
            ? { ...p, isCameraBlocked: data.isCameraBlocked, isVideoOff: data.isVideoOff }
            : p
        )
      );
    };

    const handleRoomCameraBlockChanged = (data: { guestCameraBlocked: boolean; participants?: Participant[] }) => {
      setGuestCameraBlocked(data.guestCameraBlocked);
      if (data.participants) {
        setParticipants(data.participants.filter(p => p.socketId !== socket.id));
      }
    };

    socket.on('poll-created', handlePollCreated);
    socket.on('poll-updated', handlePollUpdated);
    socket.on('polls-list', handlePollsList);
    socket.on('poll-error', handlePollError);
    socket.on('camera-blocked', handleCameraBlocked);
    socket.on('camera-unblocked', handleCameraUnblocked);
    socket.on('participant-camera-block-changed', handleParticipantCameraBlockChanged);
    socket.on('room-camera-block-changed', handleRoomCameraBlockChanged);

    // Request existing polls after joining
    socket.emit('get-polls');

    return () => {
      isCancelled = true;
      socket.off('meeting-joined', handleMeetingJoined);
      socket.off('waiting-room-status', handleWaitingRoomStatus);
      socket.off('meeting-admitted', handleMeetingAdmitted);
      socket.off('meeting-rejected', handleMeetingRejected);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('participant-media-changed', handleParticipantMediaChanged);
      socket.off('raise-hand-changed', handleRaiseHandChanged);
      socket.off('waiting-participants-updated', handleWaitingParticipantsUpdated);
      socket.off('force-mute', handleForceMute);
      socket.off('removed-from-meeting', handleRemovedFromMeeting);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('room-lock-changed', handleRoomLockChanged);
      socket.off('waiting-room-changed', handleWaitingRoomChanged);
      socket.off('chat-message-received', handleChatMessageReceived);
      socket.off('chat-error', handleChatError);
      socket.off('reaction-received', handleReactionReceived);
      socket.off('meeting-error', handleMeetingError);
      socket.off('poll-created', handlePollCreated);
      socket.off('poll-updated', handlePollUpdated);
      socket.off('polls-list', handlePollsList);
      socket.off('poll-error', handlePollError);
      socket.off('camera-blocked', handleCameraBlocked);
      socket.off('camera-unblocked', handleCameraUnblocked);
      socket.off('participant-camera-block-changed', handleParticipantCameraBlockChanged);
      socket.off('room-camera-block-changed', handleRoomCameraBlockChanged);

      socket.emit('leave-meeting');
      stopMedia();
      closeAllConnections();
    };
  }, [meetingId]);

  // Sync Local Media State to Room
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.connected) {
      socket.emit('update-media-state', {
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
      });
    }
  }, [isAudioMuted, isVideoOff, isScreenSharing]);

  // Screen Share Toggle
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  // Raise Hand State
  const [isLocalHandRaised, setIsLocalHandRaised] = useState(false);
  const handleToggleHand = () => {
    const nextState = !isLocalHandRaised;
    setIsLocalHandRaised(nextState);
    socketRef.current.emit('toggle-raise-hand', { isHandRaised: nextState });
  };

  // Send Reaction
  const handleSendReaction = (emoji: string) => {
    socketRef.current.emit('send-reaction', { emoji });
    // Local reflection
    setReactions(prev => {
      const updated = new Map(prev);
      updated.set('local', emoji);
      return updated;
    });
    if (emoji === '🎉' || emoji === '🚀') {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    }
    setTimeout(() => {
      setReactions(prev => {
        const updated = new Map(prev);
        updated.delete('local');
        return updated;
      });
    }, 2500);
  };

  // Send Chat Message
  const handleSendMessage = (content: string) => {
    socketRef.current.emit('send-chat-message', { content });
  };

  // Poll Handlers
  const handleCreatePoll = (question: string, options: string[]) => {
    socketRef.current.emit('create-poll', { question, options });
  };

  const handleVotePoll = (pollId: string, optionId: string) => {
    socketRef.current.emit('vote-poll', { pollId, optionId });
  };

  const handleClosePoll = (pollId: string) => {
    socketRef.current.emit('close-poll', { pollId });
  };

  // Host Action Handlers
  const handleAdmit = (socketId: string) => {
    socketRef.current.emit('admit-participant', { targetSocketId: socketId });
  };

  const handleReject = (socketId: string) => {
    socketRef.current.emit('reject-participant', { targetSocketId: socketId });
  };

  const handleMuteParticipant = (socketId: string) => {
    socketRef.current.emit('mute-participant', { targetSocketId: socketId });
  };

  const handleRemoveParticipant = (socketId: string) => {
    socketRef.current.emit('remove-participant', { targetSocketId: socketId });
  };

  const handleToggleLock = (lock: boolean) => {
    socketRef.current.emit('toggle-lock-room', { isLocked: lock });
  };

  const handleToggleWaitingRoom = (enable: boolean) => {
    socketRef.current.emit('toggle-waiting-room', { enabled: enable });
  };

  const handleBlockCamera = (socketId: string) => {
    socketRef.current.emit('block-participant-camera', { targetSocketId: socketId });
  };

  const handleUnblockCamera = (socketId: string) => {
    socketRef.current.emit('unblock-participant-camera', { targetSocketId: socketId });
  };

  const handleToggleGuestCameraBlock = (isBlocked: boolean) => {
    socketRef.current.emit('toggle-room-camera-block', { isBlocked });
  };

  const handleToggleVideo = () => {
    if (isCameraBlocked) {
      setCameraBlockedNotice('Camera access has been disabled by the meeting host.');
      setTimeout(() => setCameraBlockedNotice(null), 4000);
      return;
    }
    toggleVideo();
  };

  // Leave & End Meeting Handlers
  const handleLeaveOnly = () => {
    stopMedia();
    closeAllConnections();
    socketRef.current.emit('leave-meeting');
    disconnectSocket();
    navigate('/ended');
  };

  const handleEndForEveryone = () => {
    stopMedia();
    closeAllConnections();
    socketRef.current.emit('end-meeting-for-everyone');
    disconnectSocket();
    navigate('/ended');
  };

  // 1-Click Copy Meeting Link
  const handleCopyLink = () => {
    const url = `${window.location.origin}/meet/${meetingId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // -----------------------------------------------------------------
  // WAITING ROOM SCREEN
  // -----------------------------------------------------------------
  if (isInWaitingRoom) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-gray-900 border border-gray-800 text-center space-y-6 shadow-2xl">
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-brand-500/30 animate-ping-slow" />
            <div className="w-16 h-16 rounded-full bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
              <DoorClosed className="w-8 h-8" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Waiting Room</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{waitingRoomMessage}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-800/60 border border-gray-700/60 text-xs text-gray-300">
            Meeting ID: <span className="font-mono text-brand-300 font-semibold">{meetingId}</span>
          </div>

          <button
            onClick={() => {
              stopMedia();
              disconnectSocket();
              navigate('/dashboard');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-xs transition-colors"
          >
            Leave Waiting Room
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // MAIN LIVE MEETING ROOM SCREEN
  // -----------------------------------------------------------------
  return (
    <div className="h-screen w-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-14 px-4 sm:px-6 bg-gray-950/90 border-b border-gray-850 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3 truncate">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-xs">
              {meetingTitle}
            </h1>
          </div>

          {/* Meeting ID & Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs text-gray-300 hover:text-white transition-colors"
            title="Copy invitation link"
          >
            <span className="font-mono text-[11px] text-gray-400">{meetingId}</span>
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {isLocked && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
              <Lock className="w-3 h-3" /> Locked
            </span>
          )}
        </div>

        {/* Right Header Status: Duration & Secure WebRTC Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-800">
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            <span className="font-mono">{formatDuration(meetingDuration)}</span>
          </div>

          <div
            className="hidden sm:flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-medium"
            title="Active WebRTC connection"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Encrypted</span>
          </div>
        </div>
      </header>

      {/* Main Video Stage */}
      <main className="flex-1 relative overflow-hidden flex">
        {/* Host Camera Block Notice Toast */}
        {cameraBlockedNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-900/95 border border-rose-500/40 text-rose-300 text-xs font-semibold shadow-2xl backdrop-blur-md animate-fadeIn">
            <VideoOff className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{cameraBlockedNotice}</span>
          </div>
        )}

        {/* Camera / Mic Hardware Error Toast */}
        {permissionError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-950/95 border border-amber-500/50 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-fadeIn max-w-lg text-center">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{permissionError}</span>
          </div>
        )}

        {/* Media Prompt when both camera and mic are off on join */}
        {showMediaPrompt && isVideoOff && isAudioMuted && !permissionError && !cameraBlockedNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-gray-900/95 border border-brand-500/40 text-brand-200 text-xs font-medium shadow-2xl backdrop-blur-md animate-fadeIn">
            <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
            <span>Camera & Mic are off. Enable them to speak and show video.</span>
            <button
              onClick={() => {
                toggleAudio();
                toggleVideo();
                setShowMediaPrompt(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-[11px] transition-colors shadow"
            >
              Turn On
            </button>
            <button
              onClick={() => setShowMediaPrompt(false)}
              className="text-gray-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        <VideoGrid
          localStream={localStream}
          localDisplayName={initialDisplayName}
          isLocalHost={isHost}
          isLocalAudioMuted={isAudioMuted}
          isLocalVideoOff={isVideoOff}
          isLocalHandRaised={isLocalHandRaised}
          localSpeaking={!isAudioMuted && audioLevel > 15}
          participants={participants}
          remoteStreams={remoteStreams}
          reactions={reactions}
        />

        {/* Slide-in Chat Drawer */}
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          onSendMessage={handleSendMessage}
          chatError={chatError}
        />

        {/* Slide-in Participants Drawer */}
        <ParticipantsDrawer
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          isHost={isHost}
          isLocked={isLocked}
          waitingRoomEnabled={waitingRoomEnabled}
          localDisplayName={initialDisplayName}
          isLocalAudioMuted={isAudioMuted}
          isLocalVideoOff={isVideoOff}
          isLocalHandRaised={isLocalHandRaised}
          guestCameraBlocked={guestCameraBlocked}
          participants={participants}
          waitingList={waitingList}
          onAdmitParticipant={handleAdmit}
          onRejectParticipant={handleReject}
          onMuteParticipant={handleMuteParticipant}
          onRemoveParticipant={handleRemoveParticipant}
          onBlockCamera={handleBlockCamera}
          onUnblockCamera={handleUnblockCamera}
          onToggleLockRoom={handleToggleLock}
          onToggleWaitingRoom={handleToggleWaitingRoom}
          onToggleGuestCameraBlock={handleToggleGuestCameraBlock}
        />

        {/* Slide-in Polls Drawer */}
        <PollDrawer
          isOpen={isPollsOpen}
          onClose={() => setIsPollsOpen(false)}
          isHost={isHost}
          polls={polls}
          pollError={pollError}
          onCreatePoll={handleCreatePoll}
          onVotePoll={handleVotePoll}
          onClosePoll={handleClosePoll}
        />
      </main>

      {/* Bottom Floating Toolbar */}
      <footer className="shrink-0">
        <MeetingControls
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isHandRaised={isLocalHandRaised}
          isChatOpen={isChatOpen}
          isParticipantsOpen={isParticipantsOpen}
          isPollsOpen={isPollsOpen}
          unreadCount={unreadCount}
          participantCount={participants.length + 1}
          activePollCount={polls.filter(p => p.isActive).length}
          audioLevel={audioLevel}
          onToggleMic={toggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleHand={handleToggleHand}
          onToggleChat={() => {
            setIsChatOpen(prev => {
              if (!prev) setUnreadCount(0);
              return !prev;
            });
            setIsParticipantsOpen(false);
            setIsPollsOpen(false);
          }}
          onToggleParticipants={() => {
            setIsParticipantsOpen(prev => !prev);
            setIsChatOpen(false);
            setIsPollsOpen(false);
          }}
          onTogglePolls={() => {
            setIsPollsOpen(prev => !prev);
            setIsChatOpen(false);
            setIsParticipantsOpen(false);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
          onSendReaction={handleSendReaction}
        />
      </footer>

      {/* Device Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        localStream={localStream}
        audioLevel={audioLevel}
        audioInputs={audioInputs}
        videoInputs={videoInputs}
        audioOutputs={audioOutputs}
        selectedAudioInput={selectedAudioInput}
        selectedVideoInput={selectedVideoInput}
        selectedAudioOutput={selectedAudioOutput}
        onSelectAudioInput={setSelectedAudioInput}
        onSelectVideoInput={setSelectedVideoInput}
        onSelectAudioOutput={setSelectedAudioOutput}
      />

      {/* Leave / End Meeting Confirmation Modal */}
      <LeaveConfirmationModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        isHost={isHost}
        onLeaveOnly={handleLeaveOnly}
        onEndForEveryone={handleEndForEveryone}
      />
    </div>
  );
};
