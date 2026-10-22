import { MeetingDetails, IceServer, User } from '../types';

const RENDER_BACKEND_URL = 'https://ather-meet.onrender.com';
const envApiUrl = (import.meta as any).env?.VITE_API_URL;
const API_BASE = envApiUrl ? `${envApiUrl.replace(/\/$/, '')}/api` : `${RENDER_BACKEND_URL}/api`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('aethermeet_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async register(data: { email: string; name: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Registration failed');
    return body;
  },

  async login(data: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Login failed');
    return body;
  },

  async demoLogin(role: 'host' | 'guest' = 'host'): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Demo login failed');
    return body;
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to fetch user');
    return body;
  },

  async createMeeting(data: { title?: string; waitingRoomEnabled?: boolean; scheduledAt?: string | null }): Promise<{
    meeting: MeetingDetails;
    iceServers: IceServer[];
  }> {
    const res = await fetch(`${API_BASE}/meetings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to create meeting');
    return body;
  },

  async getMeeting(meetingId: string): Promise<{ meeting: MeetingDetails; iceServers: IceServer[] }> {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to get meeting');
    return body;
  },

  async getUserMeetings(): Promise<{ meetings: any[] }> {
    const res = await fetch(`${API_BASE}/meetings/my-meetings`, {
      headers: getAuthHeaders(),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to get user meetings');
    return body;
  },

  /**
   * Fetches fresh ICE server config (STUN + TURN) from the backend.
   * When METERED_API_KEY is set on Render, this returns time-limited TURN
   * credentials. Falls back to STUN-only if not configured.
   * No auth header required — TURN credentials are not user-specific.
   */
  async getIceServers(): Promise<{ iceServers: IceServer[] }> {
    try {
      const res = await fetch(`${API_BASE}/ice-servers`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to fetch ICE servers');
      return body;
    } catch (err) {
      console.warn('[ICE] Could not fetch ICE servers from backend, using empty list:', err);
      return { iceServers: [] };
    }
  },
};
