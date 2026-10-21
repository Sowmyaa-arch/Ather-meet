import React, { useState } from 'react';
import { VideoTile } from './VideoTile';
import { Participant } from '../types';

interface VideoGridProps {
  localStream: MediaStream | null;
  localDisplayName: string;
  isLocalHost: boolean;
  isLocalAudioMuted: boolean;
  isLocalVideoOff: boolean;
  isLocalHandRaised: boolean;
  localSpeaking: boolean;
  participants: Participant[];
  remoteStreams: Map<string, MediaStream>;
  reactions: Map<string, string>; // socketId -> current reaction emoji
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  localDisplayName,
  isLocalHost,
  isLocalAudioMuted,
  isLocalVideoOff,
  isLocalHandRaised,
  localSpeaking,
  participants,
  remoteStreams,
  reactions,
}) => {
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const totalParticipants = participants.length + 1; // including local

  // Grid classes according to participant count when not in pinned mode
  const getGridClass = () => {
    if (pinnedId) {
      return 'flex flex-col lg:flex-row gap-4 h-full';
    }
    if (totalParticipants === 1) return 'grid grid-cols-1 max-w-4xl mx-auto h-full max-h-[75vh]';
    if (totalParticipants === 2) return 'grid grid-cols-1 md:grid-cols-2 gap-4 h-full max-h-[75vh]';
    if (totalParticipants <= 4) return 'grid grid-cols-1 sm:grid-cols-2 gap-4 h-full max-h-[80vh]';
    if (totalParticipants <= 6) return 'grid grid-cols-2 md:grid-cols-3 gap-3 h-full max-h-[82vh]';
    return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 h-full max-h-[85vh]';
  };

  // Render Pinned / Spotlight Layout
  if (pinnedId) {
    const isLocalPinned = pinnedId === 'local';
    const pinnedRemote = participants.find(p => p.socketId === pinnedId);

    return (
      <div className="w-full h-full flex flex-col lg:flex-row gap-4 p-2 sm:p-4 overflow-hidden">
        {/* Remote Audio tags for all remote peers */}
        {participants.map(p => {
          const stream = remoteStreams.get(p.socketId);
          if (!stream) return null;
          return <RemoteAudio key={`audio-${p.socketId}`} stream={stream} isMuted={p.isAudioMuted} />;
        })}

        {/* Large Main Spotlight Tile */}
        <div className="flex-1 min-h-[300px] h-full">
          {isLocalPinned ? (
            <VideoTile
              stream={localStream}
              displayName={localDisplayName}
              isLocal
              isHost={isLocalHost}
              isAudioMuted={isLocalAudioMuted}
              isVideoOff={isLocalVideoOff}
              isHandRaised={isLocalHandRaised}
              isSpeaking={localSpeaking}
              isPinned
              onTogglePin={() => setPinnedId(null)}
              floatingReaction={reactions.get('local')}
            />
          ) : pinnedRemote ? (
            <VideoTile
              stream={remoteStreams.get(pinnedRemote.socketId)}
              displayName={pinnedRemote.displayName}
              isHost={pinnedRemote.role === 'HOST'}
              isAudioMuted={pinnedRemote.isAudioMuted}
              isVideoOff={pinnedRemote.isVideoOff}
              isHandRaised={pinnedRemote.isHandRaised}
              isPinned
              onTogglePin={() => setPinnedId(null)}
              floatingReaction={reactions.get(pinnedRemote.socketId)}
            />
          ) : null}
        </div>

        {/* Thumbnails Sidebar */}
        <div className="lg:w-72 xl:w-80 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto max-h-48 lg:max-h-full py-2">
          {!isLocalPinned && (
            <div className="min-w-[180px] lg:min-w-0 h-36">
              <VideoTile
                stream={localStream}
                displayName={localDisplayName}
                isLocal
                isHost={isLocalHost}
                isAudioMuted={isLocalAudioMuted}
                isVideoOff={isLocalVideoOff}
                isHandRaised={isLocalHandRaised}
                isSpeaking={localSpeaking}
                onTogglePin={() => setPinnedId('local')}
                floatingReaction={reactions.get('local')}
              />
            </div>
          )}
          {participants
            .filter(p => p.socketId !== pinnedId)
            .map(p => (
              <div key={p.socketId} className="min-w-[180px] lg:min-w-0 h-36">
                <VideoTile
                  stream={remoteStreams.get(p.socketId)}
                  displayName={p.displayName}
                  isHost={p.role === 'HOST'}
                  isAudioMuted={p.isAudioMuted}
                  isVideoOff={p.isVideoOff}
                  isHandRaised={p.isHandRaised}
                  onTogglePin={() => setPinnedId(p.socketId)}
                  floatingReaction={reactions.get(p.socketId)}
                />
              </div>
            ))}
        </div>
      </div>
    );
  }

  // Regular Grid Layout
  return (
    <div className="w-full h-full p-2 sm:p-4 overflow-y-auto flex items-center justify-center">
      {/* Remote Audio tags for playback */}
      {participants.map(p => {
        const stream = remoteStreams.get(p.socketId);
        if (!stream) return null;
        return <RemoteAudio key={`audio-${p.socketId}`} stream={stream} isMuted={p.isAudioMuted} />;
      })}

      <div className={`w-full ${getGridClass()}`}>
        {/* Local Participant Tile */}
        <VideoTile
          stream={localStream}
          displayName={localDisplayName}
          isLocal
          isHost={isLocalHost}
          isAudioMuted={isLocalAudioMuted}
          isVideoOff={isLocalVideoOff}
          isHandRaised={isLocalHandRaised}
          isSpeaking={localSpeaking}
          onTogglePin={() => setPinnedId('local')}
          floatingReaction={reactions.get('local')}
        />

        {/* Remote Participants Tiles */}
        {participants.map(p => (
          <VideoTile
            key={p.socketId}
            stream={remoteStreams.get(p.socketId)}
            displayName={p.displayName}
            isHost={p.role === 'HOST'}
            isAudioMuted={p.isAudioMuted}
            isVideoOff={p.isVideoOff}
            isHandRaised={p.isHandRaised}
            onTogglePin={() => setPinnedId(p.socketId)}
            floatingReaction={reactions.get(p.socketId)}
          />
        ))}
      </div>
    </div>
  );
};

// Component that attaches remote audio stream and guarantees playback
const RemoteAudio: React.FC<{ stream: MediaStream; isMuted: boolean }> = ({ stream, isMuted }) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(e => console.warn('Audio autoplay blocked, click to resume:', e));
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline muted={isMuted} className="hidden" />;
};
