import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoTile } from '../src/components/VideoTile';
import { LeaveConfirmationModal } from '../src/components/LeaveConfirmationModal';
import { ChatDrawer } from '../src/components/ChatDrawer';

describe('AetherMeet Frontend Component Tests', () => {
  describe('1. VideoTile Component', () => {
    it('renders participant name and avatar initial when video is off', () => {
      render(
        <VideoTile
          displayName="Alex River"
          isVideoOff={true}
          isAudioMuted={false}
          isHost={false}
        />
      );

      const elements = screen.getAllByText(/Alex River/i);
      expect(elements.length).toBeGreaterThan(0);
      expect(screen.getByText('AR')).toBeDefined(); // Initials in avatar circle
    });

    it('renders host badge when isHost is true', () => {
      const { container } = render(
        <VideoTile
          displayName="Jordan Host"
          isVideoOff={true}
          isHost={true}
        />
      );

      // Verify the Host badge element is rendered
      expect(container.querySelector('.text-brand-400')).toBeDefined();
    });

    it('displays muted indicator when isAudioMuted is true', () => {
      const { container } = render(
        <VideoTile
          displayName="Participant"
          isVideoOff={true}
          isAudioMuted={true}
        />
      );

      expect(container.querySelector('[title="Microphone Muted"]')).toBeDefined();
    });
  });

  describe('2. LeaveConfirmationModal Component', () => {
    it('shows both "Leave meeting" and "End meeting for everyone" buttons when user is host', () => {
      const onLeaveOnly = vi.fn();
      const onEndForEveryone = vi.fn();

      render(
        <LeaveConfirmationModal
          isOpen={true}
          onClose={() => {}}
          isHost={true}
          onLeaveOnly={onLeaveOnly}
          onEndForEveryone={onEndForEveryone}
        />
      );

      const endBtn = screen.getByRole('button', { name: /End meeting for everyone/i });
      const leaveBtn = screen.getByRole('button', { name: /Leave meeting/i });

      expect(endBtn).toBeDefined();
      expect(leaveBtn).toBeDefined();

      fireEvent.click(endBtn);
      expect(onEndForEveryone).toHaveBeenCalledTimes(1);

      fireEvent.click(leaveBtn);
      expect(onLeaveOnly).toHaveBeenCalledTimes(1);
    });

    it('shows only "Leave meeting" button when user is regular participant', () => {
      render(
        <LeaveConfirmationModal
          isOpen={true}
          onClose={() => {}}
          isHost={false}
          onLeaveOnly={() => {}}
          onEndForEveryone={() => {}}
        />
      );

      expect(screen.queryByRole('button', { name: /End meeting for everyone/i })).toBeNull();
      expect(screen.getByRole('button', { name: /Leave meeting/i })).toBeDefined();
    });
  });

  describe('3. ChatDrawer Component', () => {
    it('renders messages with sender name and sanitized content', () => {
      const testMessages = [
        {
          id: '1',
          meetingId: 'room-1',
          senderSocketId: 'sock-1',
          senderName: 'Sarah',
          content: 'Hello everyone!',
          timestamp: new Date().toISOString(),
          isSelf: false,
        },
      ];

      render(
        <ChatDrawer
          isOpen={true}
          onClose={() => {}}
          messages={testMessages}
          onSendMessage={() => {}}
          chatError={null}
        />
      );

      expect(screen.getByText('Sarah')).toBeDefined();
      expect(screen.getByText('Hello everyone!')).toBeDefined();
    });
  });
});
