import React from 'react';
import {
  X,
  Shield,
  Crown,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  UserCheck,
  UserX,
  VolumeX,
  UserMinus,
  Lock,
  Unlock,
  DoorClosed,
} from 'lucide-react';
import { Participant, WaitingParticipant } from '../types';

interface ParticipantsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  isLocked: boolean;
  waitingRoomEnabled: boolean;
  guestCameraBlocked?: boolean;
  localDisplayName: string;
  isLocalAudioMuted: boolean;
  isLocalVideoOff: boolean;
  isLocalHandRaised: boolean;
  participants: Participant[];
  waitingList: WaitingParticipant[];
  onAdmitParticipant: (socketId: string) => void;
  onRejectParticipant: (socketId: string) => void;
  onMuteParticipant: (socketId: string) => void;
  onMuteAll: () => void;
  onTransferHost: (socketId: string) => void;
  onRemoveParticipant: (socketId: string) => void;
  onBlockCamera: (socketId: string) => void;
  onUnblockCamera: (socketId: string) => void;
  onToggleLockRoom: (lock: boolean) => void;
  onToggleWaitingRoom: (enable: boolean) => void;
  onToggleGuestCameraBlock: (block: boolean) => void;
}

export const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  isOpen,
  onClose,
  isHost,
  isLocked,
  waitingRoomEnabled,
  guestCameraBlocked = false,
  localDisplayName,
  isLocalAudioMuted,
  isLocalVideoOff,
  isLocalHandRaised,
  participants,
  waitingList,
  onAdmitParticipant,
  onRejectParticipant,
  onMuteParticipant,
  onMuteAll,
  onTransferHost,
  onRemoveParticipant,
  onBlockCamera,
  onUnblockCamera,
  onToggleLockRoom,
  onToggleWaitingRoom,
  onToggleGuestCameraBlock,
}) => {
  if (!isOpen) return null;

  const totalCount = participants.length + 1; // local + remotes

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-gray-900/95 backdrop-blur-2xl border-l border-gray-800 flex flex-col shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <h2 className="text-base font-semibold text-white">Participants ({totalCount})</h2>
          <p className="text-xs text-gray-400">People currently in this meeting</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Close participants list"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Host Meeting Security Controls */}
        {isHost && (
          <div className="p-3.5 rounded-xl bg-gray-800/60 border border-gray-700/60 space-y-3">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-400" /> Host Controls
            </h3>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                {isLocked ? <Lock className="w-4 h-4 text-rose-400" /> : <Unlock className="w-4 h-4 text-emerald-400" />}
                <span>Lock Meeting</span>
              </div>
              <button
                onClick={() => onToggleLockRoom(!isLocked)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  isLocked ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {isLocked ? 'Locked' : 'Unlocked'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <DoorClosed className="w-4 h-4 text-brand-400" />
                <span>Waiting Room</span>
              </div>
              <button
                onClick={() => onToggleWaitingRoom(!waitingRoomEnabled)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  waitingRoomEnabled ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {waitingRoomEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                {guestCameraBlocked ? <VideoOff className="w-4 h-4 text-rose-400" /> : <Video className="w-4 h-4 text-emerald-400" />}
                <span>Block Guest Cameras</span>
              </div>
              <button
                onClick={() => onToggleGuestCameraBlock(!guestCameraBlocked)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  guestCameraBlocked ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {guestCameraBlocked ? 'Blocked' : 'Allowed'}
              </button>
            </div>

            <div className="pt-2 border-t border-gray-750 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-300">
                <VolumeX className="w-4 h-4 text-amber-400" />
                <span>Mute Everyone</span>
              </div>
              <button
                onClick={onMuteAll}
                className="text-xs px-2.5 py-1 rounded-lg font-medium bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white transition-colors border border-amber-500/30"
                title="Mute all non-host participants"
              >
                Mute All
              </button>
            </div>
          </div>
        )}

        {/* Waiting Room Section (Host view) */}
        {isHost && waitingList.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                Waiting Room ({waitingList.length})
              </h3>
            </div>
            <div className="space-y-2">
              {waitingList.map(w => (
                <div
                  key={w.socketId}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20"
                >
                  <span className="text-xs font-medium text-gray-200 truncate max-w-[140px]">
                    {w.displayName}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onAdmitParticipant(w.socketId)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors"
                      title="Admit into meeting"
                    >
                      <UserCheck className="w-3 h-3" /> Admit
                    </button>
                    <button
                      onClick={() => onRejectParticipant(w.socketId)}
                      className="p-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 transition-colors"
                      title="Deny entry"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In-Meeting Participants List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            In Meeting
          </h3>

          {/* Local User */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/40">
            <div className="flex items-center gap-2 truncate">
              <div className="w-7 h-7 rounded-full bg-brand-600/40 border border-brand-500/50 flex items-center justify-center text-xs text-brand-300 font-bold shrink-0">
                {localDisplayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-medium text-gray-100 truncate">
                  {localDisplayName} (You)
                </span>
                {isHost && (
                  <span className="text-[10px] text-brand-400 font-semibold flex items-center gap-0.5">
                    <Shield className="w-2.5 h-2.5" /> Host
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400">
              {isLocalHandRaised && <Hand className="w-4 h-4 text-amber-400 animate-bounce" />}
              {isLocalAudioMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              {isLocalVideoOff ? <VideoOff className="w-4 h-4 text-rose-400" /> : <Video className="w-4 h-4 text-gray-300" />}
            </div>
          </div>

          {/* Remote Participants */}
          {participants.map(p => (
            <div
              key={p.socketId}
              className="flex items-center justify-between p-2.5 rounded-xl bg-gray-800/40 border border-gray-700/40 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xs text-gray-200 font-bold shrink-0">
                  {p.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-medium text-gray-200 truncate">
                    {p.displayName}
                  </span>
                  {p.role === 'HOST' && (
                    <span className="text-[10px] text-brand-400 font-semibold flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" /> Host
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400">
                {p.isHandRaised && <Hand className="w-4 h-4 text-amber-400 animate-bounce" />}
                {p.isAudioMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                {p.isVideoOff ? <VideoOff className="w-4 h-4 text-rose-400" /> : <Video className="w-4 h-4 text-gray-300" />}

                {/* Host actions for this participant */}
                {isHost && (
                  <div className="flex items-center gap-1 pl-2 border-l border-gray-700">
                    <button
                      onClick={() => onTransferHost(p.socketId)}
                      className="p-1 rounded text-gray-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
                      title="Make Host (Transfer Host Controls)"
                    >
                      <Crown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => p.isCameraBlocked ? onUnblockCamera(p.socketId) : onBlockCamera(p.socketId)}
                      className={`p-1 rounded transition-colors ${
                        p.isCameraBlocked
                          ? 'text-rose-400 bg-rose-500/20 hover:bg-rose-500/30'
                          : 'text-gray-400 hover:text-rose-400 hover:bg-rose-400/10'
                      }`}
                      title={p.isCameraBlocked ? 'Unblock Camera Access' : 'Block Camera Access'}
                    >
                      {p.isCameraBlocked ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onMuteParticipant(p.socketId)}
                      className="p-1 rounded text-gray-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                      title="Mute Participant"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveParticipant(p.socketId)}
                      className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                      title="Remove from meeting"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
