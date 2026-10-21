import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  Smile,
  MessageSquare,
  Users,
  Settings,
  PhoneOff,
  BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';

interface MeetingControlsProps {
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isPollsOpen: boolean;
  unreadCount: number;
  participantCount: number;
  activePollCount: number;
  audioLevel: number;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHand: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onTogglePolls: () => void;
  onOpenSettings: () => void;
  onOpenLeaveModal: () => void;
  onSendReaction: (emoji: string) => void;
}

const EMOJI_REACTIONS = ['👍', '👏', '❤️', '🎉', '😂', '🔥', '🚀', '🙌'];

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  isPollsOpen,
  unreadCount,
  participantCount,
  activePollCount,
  audioLevel,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHand,
  onToggleChat,
  onToggleParticipants,
  onTogglePolls,
  onOpenSettings,
  onOpenLeaveModal,
  onSendReaction,
}) => {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div className="relative z-30 flex items-center justify-center p-3 sm:p-4">
      {/* Reactions Popup Menu */}
      {showReactions && (
        <div className="absolute bottom-20 bg-gray-900/95 backdrop-blur-xl border border-gray-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center gap-1.5 animate-fadeIn">
          {EMOJI_REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => {
                onSendReaction(emoji);
                setShowReactions(false);
              }}
              className="text-2xl hover:scale-125 hover:-translate-y-1 transition-transform p-1.5 rounded-lg hover:bg-gray-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Floating Toolbar Container */}
      <div className="flex items-center gap-2 sm:gap-3 bg-gray-950/85 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
        {/* Microphone Toggle */}
        <div className="relative">
          <button
            onClick={onToggleMic}
            className={clsx(
              'p-3 rounded-xl transition-all duration-200 flex items-center justify-center relative shadow-sm',
              isAudioMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-white'
            )}
            title={isAudioMuted ? 'Unmute Microphone (M)' : 'Mute Microphone (M)'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {/* Live Volume indicator ring when talking */}
            {!isAudioMuted && audioLevel > 15 && (
              <span className="absolute -inset-1 rounded-xl border-2 border-emerald-400 animate-pulse pointer-events-none" />
            )}
          </button>
        </div>

        {/* Video Camera Toggle */}
        <button
          onClick={onToggleVideo}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm',
            isVideoOff
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-white'
          )}
          title={isVideoOff ? 'Start Camera (V)' : 'Stop Camera (V)'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share Toggle */}
        <button
          onClick={onToggleScreenShare}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm',
            isScreenSharing
              ? 'bg-brand-600 hover:bg-brand-500 text-white ring-2 ring-brand-400'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          )}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-800 hidden sm:block" />

        {/* Raise Hand Toggle */}
        <button
          onClick={onToggleHand}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm',
            isHandRaised
              ? 'bg-amber-500 hover:bg-amber-400 text-white ring-2 ring-amber-300'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          )}
          title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* Reactions Toggle */}
        <button
          onClick={() => setShowReactions(prev => !prev)}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-sm',
            showReactions
              ? 'bg-brand-600 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          )}
          title="Send Reaction"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Polls Drawer Toggle */}
        <button
          onClick={onTogglePolls}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center relative shadow-sm',
            isPollsOpen
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          )}
          title="Polls"
        >
          <BarChart3 className="w-5 h-5" />
          {activePollCount > 0 && !isPollsOpen && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500 text-white shadow-md animate-pulse">
              {activePollCount}
            </span>
          )}
        </button>

        {/* Chat Drawer Toggle */}
        <button
          onClick={onToggleChat}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center relative shadow-sm',
            isChatOpen
              ? 'bg-brand-600 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          )}
          title="In-Meeting Chat (C)"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-md animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Participants Drawer Toggle */}
        <button
          onClick={onToggleParticipants}
          className={clsx(
            'p-3 rounded-xl transition-all duration-200 flex items-center justify-center relative shadow-sm',
            isParticipantsOpen
              ? 'bg-brand-600 text-white'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white'
          )}
          title="Participants (P)"
        >
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-700 text-gray-200 border border-gray-600">
            {participantCount}
          </span>
        </button>

        {/* Settings Modal Toggle */}
        <button
          onClick={onOpenSettings}
          className="p-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white transition-all shadow-sm"
          title="Audio & Video Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Leave / End Meeting Button */}
        <button
          onClick={onOpenLeaveModal}
          className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md ml-1 sm:ml-2 hover:scale-105"
          title="Leave Meeting"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
