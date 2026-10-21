import rateLimit from 'express-rate-limit';

// Rate limit for authentication attempts (e.g. login, register)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again in 15 minutes' },
});

// Rate limit for meeting creation
export const meetingCreateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // limit each IP to 30 meeting creations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many meetings created, please wait a few minutes' },
});

// General API rate limiter
export const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded, please slow down' },
});

// Socket event rate limiter: sliding window tracker per socket
export class SocketRateLimiter {
  private eventCounts: Map<string, { count: number; resetTime: number }> = new Map();

  public isAllowed(socketId: string, event: string, maxPerSecond: number = 10): boolean {
    const key = `${socketId}:${event}`;
    const now = Date.now();
    const entry = this.eventCounts.get(key);

    if (!entry || now > entry.resetTime) {
      this.eventCounts.set(key, { count: 1, resetTime: now + 1000 });
      return true;
    }

    if (entry.count >= maxPerSecond) {
      return false;
    }

    entry.count++;
    return true;
  }

  public cleanup(socketId: string): void {
    for (const key of this.eventCounts.keys()) {
      if (key.startsWith(`${socketId}:`)) {
        this.eventCounts.delete(key);
      }
    }
  }
}

export const socketRateLimiter = new SocketRateLimiter();
