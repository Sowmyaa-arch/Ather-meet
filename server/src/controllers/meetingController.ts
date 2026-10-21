import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { generateMeetingId } from '../utils/security.js';
import { roomManager } from '../services/RoomManager.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config/index.js';

const createMeetingSchema = z.object({
  title: z.string().min(1).max(100).optional().default('Untitled Meeting'),
  waitingRoomEnabled: z.boolean().optional().default(false),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export async function createMeeting(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required to create a meeting' });
      return;
    }

    const data = createMeetingSchema.parse(req.body);
    const meetingId = generateMeetingId();

    const meeting = await prisma.meeting.create({
      data: {
        id: meetingId,
        title: data.title,
        hostId: req.user.userId,
        waitingRoomEnabled: data.waitingRoomEnabled,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
      include: {
        host: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Initialize in RoomManager
    roomManager.getOrCreateRoom(meetingId, {
      title: meeting.title,
      hostUserId: req.user.userId,
      waitingRoomEnabled: meeting.waitingRoomEnabled,
    });

    res.status(201).json({
      message: 'Meeting created successfully',
      meeting: {
        id: meeting.id,
        title: meeting.title,
        host: meeting.host,
        waitingRoomEnabled: meeting.waitingRoomEnabled,
        isLocked: meeting.isLocked,
        createdAt: meeting.createdAt,
      },
      iceServers: config.iceServers,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMeeting(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const meetingId = String(req.params.meetingId);

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        host: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found or invalid meeting ID' });
      return;
    }

    const roomState = roomManager.getRoom(meetingId);
    const isHost = req.user?.userId === meeting.hostId;
    const participantCount = roomState ? roomState.participants.size : 0;
    const isLocked = roomState ? roomState.isLocked : meeting.isLocked;
    const waitingRoomEnabled = roomState ? roomState.waitingRoomEnabled : meeting.waitingRoomEnabled;

    res.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        host: meeting.host,
        isLocked,
        waitingRoomEnabled,
        participantCount,
        isHost,
        endedAt: meeting.endedAt,
      },
      iceServers: config.iceServers,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserMeetings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const meetings = await prisma.meeting.findMany({
      where: { hostId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: {
          select: { participants: true, messages: true },
        },
      },
    });

    res.json({ meetings });
  } catch (error) {
    next(error);
  }
}

export async function getIceServers(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  res.json({ iceServers: config.iceServers });
}
