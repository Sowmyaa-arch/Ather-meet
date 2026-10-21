import React, { useRef, useEffect } from 'react';
import { X, Mic, Video, Volume2, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { DeviceInfo, isStreamSimulated } from '../hooks/useMediaDevices';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  localStream: MediaStream | null;
  audioLevel: number;
  audioInputs: DeviceInfo[];
  videoInputs: DeviceInfo[];
  audioOutputs: DeviceInfo[];
  selectedAudioInput: string;
  selectedVideoInput: string;
  selectedAudioOutput: string;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  onSelectAudioOutput: (deviceId: string) => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  localStream,
  audioLevel,
  audioInputs,
  videoInputs,
  audioOutputs,
  selectedAudioInput,
  selectedVideoInput,
  selectedAudioOutput,
  onSelectAudioInput,
  onSelectVideoInput,
  onSelectAudioOutput,
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoPreviewRef.current && localStream) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [localStream, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Audio & Video Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Microphone Selector & Live Meter */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
              <Mic className="w-4 h-4 text-brand-400" /> Microphone
            </label>
            <select
              value={selectedAudioInput}
              onChange={e => onSelectAudioInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {audioInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>

            {/* Live Volume Meter */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Input Level</span>
                <span>{audioLevel}%</span>
              </div>
              <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75 rounded-full"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Camera Selector & Preview */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
              <Video className="w-4 h-4 text-brand-400" /> Camera
            </label>
            <select
              value={selectedVideoInput}
              onChange={e => onSelectVideoInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {videoInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>

            {/* Camera Preview Thumbnail */}
            <div className="mt-3 relative h-36 bg-gray-950 rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center">
              {localStream && localStream.getVideoTracks().length > 0 ? (
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={clsx(
                    'w-full h-full object-cover',
                    !isStreamSimulated(localStream) && 'video-mirrored'
                  )}
                />
              ) : (
                <span className="text-xs text-gray-500">Camera preview unavailable</span>
              )}
            </div>
          </div>

          {/* Speakers Selector (if supported) */}
          {audioOutputs.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-2">
                <Volume2 className="w-4 h-4 text-brand-400" /> Speakers / Audio Output
              </label>
              <select
                value={selectedAudioOutput}
                onChange={e => onSelectAudioOutput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {audioOutputs.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" /> Done
          </button>
        </div>
      </div>
    </div>
  );
};
