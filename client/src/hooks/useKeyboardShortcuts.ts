import { useEffect } from 'react';

interface ShortcutHandlers {
  onToggleMic?: () => void;
  onToggleVideo?: () => void;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
  onCloseModals?: () => void;
}

export function useKeyboardShortcuts({
  onToggleMic,
  onToggleVideo,
  onToggleChat,
  onToggleParticipants,
  onCloseModals,
}: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        if (e.key === 'Escape' && onCloseModals) {
          onCloseModals();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMic?.();
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        onToggleVideo?.();
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        onToggleChat?.();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        onToggleParticipants?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCloseModals?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleMic, onToggleVideo, onToggleChat, onToggleParticipants, onCloseModals]);
}
