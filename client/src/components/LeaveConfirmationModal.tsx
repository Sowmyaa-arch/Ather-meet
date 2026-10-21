import React from 'react';
import { LogOut, Power, X } from 'lucide-react';

interface LeaveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHost: boolean;
  onLeaveOnly: () => void;
  onEndForEveryone: () => void;
}

export const LeaveConfirmationModal: React.FC<LeaveConfirmationModalProps> = ({
  isOpen,
  onClose,
  isHost,
  onLeaveOnly,
  onEndForEveryone,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Leave Meeting</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-gray-300">
          {isHost
            ? 'As the host, you can leave the meeting while allowing others to continue, or end the meeting for all participants.'
            : 'Are you sure you want to leave this meeting? You can rejoin at any time using the meeting link.'}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {isHost && (
            <button
              onClick={onEndForEveryone}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              <Power className="w-4 h-4" /> End meeting for everyone
            </button>
          )}

          <button
            onClick={onLeaveOnly}
            className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors border border-gray-700"
          >
            <LogOut className="w-4 h-4" /> Leave meeting
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-gray-400 hover:text-gray-200 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
