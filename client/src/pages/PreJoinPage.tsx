import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  ArrowRight,
  Shield,
  Lock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMediaDevices, isStreamSimulated } from '../hooks/useMediaDevices';
import { api } from '../services/api';
import { Navbar } from '../components/Navbar';
import { DeviceSettingsModal } from '../components/DeviceSettingsModal';
import { clsx } from 'clsx';

export const PreJoinPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [meetingDetails, setMeetingDetails] = useState<any>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    localStream,
    isAudioMuted,
    isVideoOff,
    isSimulated,
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
  } = useMediaDevices({
    autoStart: true,
    displayName,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (user?.name && !displayName) {
      setDisplayName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOff]);

  // Load meeting metadata
  useEffect(() => {
    async function checkMeeting() {
      if (!meetingId) return;
      try {
        const data = await api.getMeeting(meetingId);
        setMeetingDetails(data.meeting);
        if (data.meeting.endedAt) {
          setMeetingError('This meeting has already ended.');
        } else if (data.meeting.isLocked && !data.meeting.isHost) {
          setMeetingError('This meeting is currently locked by the host.');
        }
      } catch (err: any) {
        setMeetingError(err.message || 'Meeting not found or invalid meeting ID');
      } finally {
        setIsLoadingMeeting(false);
      }
    }
    checkMeeting();
  }, [meetingId]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !meetingId) return;

    // Navigate to live room with pre-configured media preferences in session storage
    sessionStorage.setItem('aethermeet_display_name', displayName.trim());
    sessionStorage.setItem('aethermeet_audio_muted', String(isAudioMuted));
    sessionStorage.setItem('aethermeet_video_off', String(isVideoOff));

    // Release preview stream so room can capture properly
    stopMedia();
    setTimeout(() => {
      navigate(`/room/${meetingId}`);
    }, 150);
  };

  if (isLoadingMeeting) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Verifying meeting room...</p>
        </div>
      </div>
    );
  }

  if (meetingError) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl bg-gray-900 border border-gray-800 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">Cannot Join Meeting</h2>
              <p className="text-sm text-gray-400">{meetingError}</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium text-sm transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Camera / Mic Preview Canvas */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-video rounded-3xl bg-gray-900 border border-gray-800 overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Video Element */}
              {localStream && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={clsx(
                    'w-full h-full object-cover',
                    isSimulated || isStreamSimulated(localStream) ? '' : 'video-mirrored',
                    isVideoOff ? 'hidden' : 'block'
                  )}
                />
              )}

              {/* Camera Off Avatar Fallback */}
              {(!localStream || isVideoOff) && (
                <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                  <div className="w-24 h-24 rounded-full bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300 text-3xl font-bold">
                    {(displayName || user?.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-400">Camera is off</span>
                </div>
              )}

              {/* In-canvas Bottom Quick Controls */}
              <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 z-20">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={`p-3 rounded-2xl backdrop-blur-md transition-all shadow-md ${
                    isAudioMuted
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-gray-900/80 hover:bg-gray-800 text-white border border-white/10'
                  }`}
                  title={isAudioMuted ? 'Unmute' : 'Mute'}
                >
                  {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-3 rounded-2xl backdrop-blur-md transition-all shadow-md ${
                    isVideoOff
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-gray-900/80 hover:bg-gray-800 text-white border border-white/10'
                  }`}
                  title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-3 rounded-2xl bg-gray-900/80 hover:bg-gray-800 text-gray-300 hover:text-white backdrop-blur-md border border-white/10 transition-colors shadow-md"
                  title="Device Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              {/* Live Microphone Meter Bar */}
              {!isAudioMuted && (
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-950/80 backdrop-blur-md border border-white/10">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Permission Error / Needs Access Prompt */}
            {permissionError && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3 shadow-lg">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-200">Camera & Microphone Access Required</p>
                    <p className="text-gray-300 leading-relaxed">{permissionError}</p>
                    <p className="text-amber-300/80 text-[11px] pt-1">
                      💡 Tip for mobile & other computers: Tap the 🔒 icon in the browser address bar, set Camera & Microphone to <strong>"Allow"</strong>, then tap the button below.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startMedia()}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  <Video className="w-4 h-4" />
                  <span>Grant Camera & Microphone Permission</span>
                </button>
              </div>
            )}

            {/* Prompt to Turn On Camera & Audio if both are off/muted */}
            {!permissionError && (!localStream || (isVideoOff && isAudioMuted)) && (
              <div className="p-3.5 rounded-2xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-2 text-brand-200">
                  <Sparkles className="w-4 h-4 text-brand-400 shrink-0" />
                  <span>Please enable your camera & microphone to participate with live video & voice.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isAudioMuted) toggleAudio();
                    if (isVideoOff) toggleVideo();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shrink-0 transition-colors shadow"
                >
                  Enable Both
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Meeting Info & Join Action */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5" />
                <span>Ready to Join</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {meetingDetails?.title || 'Video Conference'}
              </h1>
              <p className="text-xs text-gray-400 font-mono">
                Room ID: <span className="text-gray-200">{meetingId}</span>
              </p>
              {meetingDetails?.waitingRoomEnabled && (
                <p className="text-xs text-amber-300 flex items-center gap-1.5 pt-1">
                  <Lock className="w-3.5 h-3.5" /> Waiting room enabled by host
                </p>
              )}
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-1.5">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!displayName.trim()}
                className="w-full py-3.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-base shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5"
              >
                <span>Join Meeting Now</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </main>

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
    </div>
  );
};
