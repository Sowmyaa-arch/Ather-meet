import { Router } from 'express';
import {
  createMeeting,
  getMeeting,
  getUserMeetings,
  getIceServers,
} from '../controllers/meetingController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { meetingCreateRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/', requireAuth, meetingCreateRateLimiter, createMeeting);
router.get('/my-meetings', requireAuth, getUserMeetings);
router.get('/ice-servers', optionalAuth, getIceServers);
router.get('/:meetingId', optionalAuth, getMeeting);

export default router;
