/**
 * GET /api/ice-servers
 *
 * Returns fresh ICE server configuration (STUN + TURN) for WebRTC clients.
 *
 * When METERED_API_KEY is set:
 *   - Fetches time-limited TURN credentials from Metered.ca API
 *   - Credentials expire in ~1 hour, so they can't be reused if intercepted
 *
 * When METERED_API_KEY is NOT set:
 *   - Falls back to STUN-only public servers (works on same network / open NAT)
 *
 * TURN credentials are NEVER hardcoded — they come from environment variables
 * on the server and are served to clients at runtime. They do not appear in
 * the frontend bundle or source code.
 */

import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';

const router = Router();

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * Fetches fresh TURN credentials from Metered.ca REST API.
 * Returns null if the API call fails (caller falls back to STUN-only).
 */
async function fetchMeteredTurnServers(): Promise<object[] | null> {
  const apiKey = config.meteredApiKey;
  const domain = config.meteredDomain;

  if (!apiKey || !domain) return null;

  try {
    const url = `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      console.error(`[ICE] Metered API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const servers = (await response.json()) as object[];
    console.log(`[ICE] Fetched ${servers.length} TURN servers from Metered`);
    return servers;
  } catch (err) {
    console.error('[ICE] Failed to fetch Metered TURN credentials:', err);
    return null;
  }
}

// Cache TURN credentials for up to 50 minutes to avoid hammering the API
// (Metered credentials are valid for ~1 hour)
let cachedServers: object[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 minutes

router.get('/', async (_req: Request, res: Response) => {
  try {
    let iceServers: object[];

    // Use cache if still valid
    if (cachedServers && Date.now() < cacheExpiresAt) {
      iceServers = [...STUN_SERVERS, ...cachedServers];
    } else {
      const turnServers = await fetchMeteredTurnServers();
      if (turnServers && turnServers.length > 0) {
        cachedServers = turnServers;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        iceServers = [...STUN_SERVERS, ...turnServers];
        console.log('[ICE] TURN + STUN servers configured and cached');
      } else {
        // No TURN available — STUN-only fallback
        cachedServers = null;
        iceServers = [...STUN_SERVERS];
        console.warn('[ICE] No TURN credentials available — STUN-only mode (cross-NAT calls may fail)');
      }
    }

    res.json({ iceServers });
  } catch (err) {
    console.error('[ICE] Unexpected error in /api/ice-servers:', err);
    res.json({ iceServers: STUN_SERVERS }); // Always return at least STUN
  }
});

export default router;
