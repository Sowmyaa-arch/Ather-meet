import React, { useState } from 'react';
import { LogOut, Power, X, Crown, Shield } from 'lucide-react';
import { Participant } from '../types';

interface LeaveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  participants: Participant[];
  onLeaveOnly: () => void;
  onTransferAndLeave: (newHostSocketId: string) => void;
  onEndForEveryone: () => void;
}

export const LeaveConfirmationModal: React.FC<LeaveConfirmationModalProps> = ({
  isOpen,
  onClose,
  isHost,
  participants,
  onLeaveOnly,
  onTransferAndLeave,
  onEndForEveryone,
}) => {
  const [selectedHostSocketId, setSelectedHostSocketId] = useState<string>(
    participants.length > 0 ? participants[0].socketId : ''
  );

  if (!isOpen) return null;

  const hasOtherParticipants = isHost && participants.length > 0;

  const handleTransferAndLeave = () => {
    if (selectedHostSocketId) {
      onTransferAndLeave(selectedHostSocketId);
    } else if (participants.length > 0) {
      onTransferAndLeave(participants[0].socketId);
    } else {
      onLeaveOnly();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Leave Meeting</h2>
            {isHost && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Host
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-300">
          {hasOtherParticipants
            ? 'Before you leave, choose another participant to become the new host so they can manage waiting room, lock room, and audio/video controls.'
            : isHost
            ? 'You are the only person in this meeting. You can leave or end the meeting.'
            : 'Are you sure you want to leave this meeting? You can rejoin at any time using the meeting link.'}
        </p>

        {/* Host Selection Picker */}
        {hasOtherParticipants && (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Select New Host:
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {participants.map(p => (
                <button
                  key={p.socketId}
                  type="button"
                  onClick={() => setSelectedHostSocketId(p.socketId)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    selectedHostSocketId === p.socketId
                      ? 'bg-brand-600/30 text-brand-200 border border-brand-500/60 shadow-sm'
                      : 'bg-gray-800/60 text-gray-300 hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{p.displayName}</span>
                  </div>
                  {selectedHostSocketId === p.socketId && (
                    <span className="text-[11px] text-brand-400 font-semibold flex items-center gap-1">
                      <Crown className="w-3 h-3 text-amber-400" /> Selected
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {hasOtherParticipants ? (
            <>
              <button
                onClick={handleTransferAndLeave}
                className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 transition-colors"
              >
                <Crown className="w-4 h-4 text-amber-300" /> Assign Host & Leave
              </button>

              <button
                onClick={onLeaveOnly}
                className="w-full py-2 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors border border-gray-700"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave (Auto-assign host)
              </button>

              <button
                onClick={onEndForEveryone}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 border border-rose-500/30 transition-colors"
              >
                <Power className="w-3.5 h-3.5" /> End meeting for everyone
              </button>
            </>
          ) : isHost ? (
            <>
              <button
                onClick={onEndForEveryone}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <Power className="w-4 h-4" /> End meeting for everyone
              </button>

              <button
                onClick={onLeaveOnly}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-gray-700"
              >
                <LogOut className="w-4 h-4" /> Leave meeting
              </button>
            </>
          ) : (
            <button
              onClick={onLeaveOnly}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <LogOut className="w-4 h-4" /> Leave meeting
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-gray-400 hover:text-gray-200 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
