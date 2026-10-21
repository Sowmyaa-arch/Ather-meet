import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { userId: string; email: string; name: string }): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): { userId: string; email: string; name: string } | null {
  try {
    return jwt.verify(token, config.jwtSecret) as { userId: string; email: string; name: string };
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically random, collision-resistant meeting code
 * formatted as 3 lowercase blocks: 'xxx-yyyy-zzz'
 */
export function generateMeetingId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // unambiguous characters
  const getRandomBlock = (length: number) => {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  };
  return `${getRandomBlock(3)}-${getRandomBlock(4)}-${getRandomBlock(3)}`;
}

/**
 * Basic HTML sanitizer to prevent stored/reflected XSS in messages
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}
