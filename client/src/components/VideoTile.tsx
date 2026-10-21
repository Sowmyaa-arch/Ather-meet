import React, { useEffect, useRef } from 'react';
import { MicOff, Pin, PinOff, Hand, Shield, Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';
import { isStreamSimulated } from '../hooks/useMediaDevices';

interface VideoTileProps {
  stream?: MediaStream | null;
  displayName: string;
  isLocal?: boolean;
  isHost?: boolean;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isHandRaised?: boolean;
  isSpeaking?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  floatingReaction?: string | null;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  displayName,
  isLocal = false,
  isHost = false,
  isAudioMuted = false,
  isVideoOff = false,
  isHandRaised = false,
  isSpeaking = false,
  isPinned = false,
  onTogglePin,
  floatingReaction,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && stream) {
      if (node.srcObject !== stream) {
        node.srcObject = stream;
      }
      node.play().catch(() => {});
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, isVideoOff]);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative group rounded-2xl overflow-hidden bg-gray-900 border transition-all duration-300 flex items-center justify-center select-none shadow-md',
        isSpeaking ? 'speaking-glow border-emerald-500' : 'border-gray-800 hover:border-gray-700',
        isPinned ? 'ring-2 ring-brand-500' : '',
        'w-full h-full min-h-[220px]'
      )}
    >
      {/* Video Element (always mounted if stream exists so video displays immediately) */}
      {stream && (
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video so user doesn't hear own echo
          className={clsx(
            'w-full h-full object-cover',
            isLocal && !isStreamSimulated(stream) ? 'video-mirrored' : '',
            isVideoOff ? 'invisible absolute' : 'block'
          )}
        />
      )}

      {/* Camera Off Fallback Avatar */}
      {(!stream || isVideoOff) && (
        <div className="flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-brand-700 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-xl shadow-brand-500/20 border-2 border-white/10">
            {getInitials(displayName)}
          </div>
          <p className="mt-3 text-sm font-medium text-gray-300">{displayName}</p>
        </div>
      )}

      {/* Floating Reaction Animation Burst */}
      {floatingReaction && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="text-6xl animate-float-reaction filter drop-shadow-lg">
            {floatingReaction}
          </div>
        </div>
      )}

      {/* Hand Raised Banner */}
      {isHandRaised && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-semibold shadow-lg backdrop-blur-md animate-bounce">
          <Hand className="w-3.5 h-3.5" />
          <span>Hand Raised</span>
        </div>
      )}

      {/* Top Action Buttons (Pin, Fullscreen) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className="p-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-white backdrop-blur-md transition-colors"
            title={isPinned ? 'Unpin' : 'Pin for spotlight'}
          >
            {isPinned ? <PinOff className="w-4 h-4 text-brand-400" /> : <Pin className="w-4 h-4" />}
          </button>
        )}
        <button
          onClick={toggleFullScreen}
          className="p-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-white backdrop-blur-md transition-colors"
          title="Full screen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Bar: Display Name & Muted State */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-950/80 backdrop-blur-md border border-white/10 text-xs font-medium text-white max-w-[85%] truncate">
          {isHost && (
            <span className="flex items-center gap-1 text-[10px] text-brand-400 font-semibold bg-brand-500/20 px-1.5 py-0.5 rounded border border-brand-500/30">
              <Shield className="w-2.5 h-2.5" /> Host
            </span>
          )}
          <span className="truncate">{displayName} {isLocal && '(You)'}</span>
        </div>

        {/* Audio Muted Indicator */}
        {isAudioMuted && (
          <div className="p-1.5 rounded-lg bg-rose-600/90 backdrop-blur-md text-white shadow-sm" title="Microphone Muted">
            <MicOff className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};
