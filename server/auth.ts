import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { findUserByEmail } from './registry.ts';
import type { RegistryUser } from './registry.ts';

export const SESSION_COOKIE_NAME = 'cosec_vault_session';

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const OTP_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;

// Enforce robust 32+ character SESSION_SECRET
const rawSecret = process.env.SESSION_SECRET?.trim();
const SESSION_SECRET =
  rawSecret && rawSecret.length >= 32
    ? rawSecret
    : (() => {
        const generated = crypto.randomBytes(32).toString('hex');
        console.warn(
          '[CoSec Vault Security] SESSION_SECRET not provided or under 32 characters in environment. Generated secure ephemeral secret.',
        );
        return generated;
      })();

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const pendingOtps = new Map<string, OtpRecord>();

export interface AuthenticatedRequest extends Request {
  authUser?: RegistryUser;
}

export function issueOtpForEmail(email: string): {
  expiresInSeconds: number;
} {
  const normalized = email.trim().toLowerCase();
  const code = String(crypto.randomInt(100000, 1000000));

  pendingOtps.set(normalized, {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  return {
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
}

export function verifyOtpForEmail(email: string, submittedOtp: string): boolean {
  const normalized = email.trim().toLowerCase();
  const trimmedOtp = submittedOtp.trim();

  const record = pendingOtps.get(normalized);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    pendingOtps.delete(normalized);
    return false;
  }

  record.attempts += 1;
  if (record.attempts > MAX_OTP_ATTEMPTS) {
    pendingOtps.delete(normalized);
    return false;
  }

  const isMatch =
    record.code.length === trimmedOtp.length &&
    crypto.timingSafeEqual(Buffer.from(record.code), Buffer.from(trimmedOtp));

  if (isMatch) {
    pendingOtps.delete(normalized);
  }
  return isMatch;
}

interface SessionPayload {
  email: string;
  exp: number;
}

export function createSessionToken(email: string): string {
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (signature.length !== expectedSignature.length) return null;
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
    ) as SessionPayload;
    if (!payload.email || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  req: Request,
  res: Response,
  token: string,
): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });
}

export function extractSessionToken(req: Request): string | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length > 0) return bearer;
  }
  return null;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = extractSessionToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res
      .status(401)
      .json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const user = findUserByEmail(payload.email);
  if (!user) {
    res
      .status(403)
      .json({ error: 'Account is no longer active in the Client Access Registry.' });
    return;
  }

  req.authUser = user;
  next();
}
