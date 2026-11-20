import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '../src/types.ts';
import { findUserByEmail } from './registry.ts';
import type { RegistryUser } from './registry.ts';

export const SESSION_COOKIE_NAME = 'cosec_vault_session';

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

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

export interface AuthenticatedRequest extends Request {
  authUser?: RegistryUser;
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (typeof password !== 'string' || password.length < 12) {
    return {
      valid: false,
      message: 'Password must be at least 12 characters long.',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter (A–Z).',
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter (a–z).',
    };
  }
  return { valid: true };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;

  try {
    const derivedKey = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    });
    const keyBuffer = Buffer.from(keyHex, 'hex');
    if (derivedKey.length !== keyBuffer.length) return false;
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
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

  if (user.status === 'pending') {
    res.status(403).json({
      error:
        'Your account registration is pending verification by our Company Secretary department.',
    });
    return;
  }

  req.authUser = user;
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (req.authUser.status === 'pending') {
      res.status(403).json({
        error:
          'Your account registration is pending verification by our Company Secretary department.',
      });
      return;
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}.`,
      });
      return;
    }
    next();
  };
}
