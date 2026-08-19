import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

import { hmac } from './authentication-config.js';

const idleDuration = 30 * 60 * 1_000;
const absoluteDuration = 24 * 60 * 60 * 1_000;

export const generateSession = (userId: string, sessionHmacKey: Buffer) => {
  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const now = Date.now();
  const expiresAt = new Date(now + absoluteDuration);

  return {
    id: ulid(),
    userId,
    sessionToken,
    csrfToken,
    tokenHmac: hmac(sessionHmacKey, sessionToken),
    csrfHmac: hmac(sessionHmacKey, csrfToken),
    now,
    idleExpiresAt: now + idleDuration,
    expiresAt,
  };
};

export const renewIdleExpiry = (now: number, absoluteExpiresAt: number) =>
  Math.min(now + idleDuration, absoluteExpiresAt);
