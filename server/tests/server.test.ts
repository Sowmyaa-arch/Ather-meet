import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../src/index.js';
import { roomManager } from '../src/services/RoomManager.js';
import { generateMeetingId, sanitizeText } from '../src/utils/security.js';

describe('AetherMeet Backend & WebRTC Coordination Tests', () => {
  let authToken: string;
  let testMeetingId: string;

  beforeAll(async () => {
    // Wait for server readiness if needed
  });

  afterAll(async () => {
    httpServer.close();
  });

  describe('1. Health Check Endpoint', () => {
    it('returns ok status and active room stats', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.stats).toBeDefined();
    });
  });

  describe('2. Authentication Endpoints', () => {
    const testEmail = `test_${Date.now()}@aethermeet.io`;

    it('successfully registers a new user with hashed password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: testEmail,
        name: 'Sarah Connor',
        password: 'password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.passwordHash).toBeUndefined(); // never expose password hash!
      authToken = res.body.token;
    });

    it('fails login with incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('successfully logs in with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('returns current user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Sarah Connor');
    });

    it('rejects protected endpoints without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Meeting Creation & Room Access', () => {
    it('creates a new meeting with cryptographically formatted ID', async () => {
      const res = await request(app)
        .post('/api/meetings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Design Review & WebRTC Architecture',
          waitingRoomEnabled: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.meeting.id).toMatch(/^[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/);
      expect(res.body.meeting.waitingRoomEnabled).toBe(true);
      expect(res.body.iceServers).toBeDefined();
      testMeetingId = res.body.meeting.id;
    });

    it('retrieves meeting details and ice server configuration', async () => {
      const res = await request(app).get(`/api/meetings/${testMeetingId}`);
      expect(res.status).toBe(200);
      expect(res.body.meeting.title).toBe('Design Review & WebRTC Architecture');
      expect(res.body.iceServers.length).toBeGreaterThan(0);
    });

    it('returns 404 for nonexistent meeting ID', async () => {
      const res = await request(app).get('/api/meetings/non-existent-id-999');
      expect(res.status).toBe(404);
    });
  });

  describe('4. Multi-Meeting Concurrency & Room Isolation (RoomManager)', () => {
    it('isolates participants and states across independent rooms simultaneously', () => {
      const roomA = 'room-alpha-001';
      const roomB = 'room-beta-002';

      roomManager.getOrCreateRoom(roomA, { title: 'Room Alpha', hostUserId: 'user-1' });
      roomManager.getOrCreateRoom(roomB, { title: 'Room Beta', hostUserId: 'user-2' });

      // Add participant to Room A
      roomManager.addParticipant(roomA, {
        socketId: 'sock-a1',
        peerId: 'sock-a1',
        displayName: 'Alice',
        role: 'HOST',
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
      });

      // Add participant to Room B
      roomManager.addParticipant(roomB, {
        socketId: 'sock-b1',
        peerId: 'sock-b1',
        displayName: 'Bob',
        role: 'HOST',
        isAudioMuted: true,
        isVideoOff: true,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
      });

      // Verify Alice is in Room A and NOT in Room B
      const alice = roomManager.findParticipantBySocketId('sock-a1');
      expect(alice).toBeDefined();
      expect(alice?.meetingId).toBe(roomA);

      const bob = roomManager.findParticipantBySocketId('sock-b1');
      expect(bob).toBeDefined();
      expect(bob?.meetingId).toBe(roomB);

      const roomAParticipants = roomManager.getParticipantsList(roomA);
      expect(roomAParticipants.length).toBe(1);
      expect(roomAParticipants[0].displayName).toBe('Alice');

      const roomBParticipants = roomManager.getParticipantsList(roomB);
      expect(roomBParticipants.length).toBe(1);
      expect(roomBParticipants[0].displayName).toBe('Bob');

      // Clean up
      roomManager.removeParticipant(roomA, 'sock-a1');
      roomManager.removeParticipant(roomB, 'sock-b1');
    });
  });

  describe('5. Security Utilities', () => {
    it('generates random meeting ids matching format', () => {
      const id1 = generateMeetingId();
      const id2 = generateMeetingId();
      expect(id1).not.toBe(id2);
      expect(id1.split('-').length).toBe(3);
    });

    it('sanitizes malicious script injections from text', () => {
      const malicious = '<script>alert("xss")</script>Hello & welcome!';
      const sanitized = sanitizeText(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&amp;');
    });
  });
});
