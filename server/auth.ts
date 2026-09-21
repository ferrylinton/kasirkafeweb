import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { getDB, fallbackStore } from './db';
import { getSessionFromRedis, removeSessionFromRedis, getActiveTokenForUser, RedisSessionData } from './sessionStore';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'beverage_pos_jwt_secret_key_2026';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  name: string;
  sessionId?: string;
  vendorId?: string;
  clientId?: string;
}

// In-memory set of revoked session IDs for O(1) instantaneous lookup
export const revokedSessionIds = new Set<string>();

export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  if (revokedSessionIds.has(sessionId)) return true;
  if (fallbackStore.revoked_sessions && fallbackStore.revoked_sessions.includes(sessionId)) {
    revokedSessionIds.add(sessionId);
    return true;
  }

  const db = getDB();
  if (db) {
    try {
      const revoked = await db.collection('login_history').findOne({
        sessionId,
        status: { $in: ['REVOKED', 'LOGGED_OUT'] }
      });
      if (revoked) {
        revokedSessionIds.add(sessionId);
        return true;
      }
    } catch (e) {}
  } else {
    const entry = fallbackStore.login_history.find(h => h.sessionId === sessionId);
    if (entry && (entry.status === 'REVOKED' || entry.status === 'LOGGED_OUT')) {
      revokedSessionIds.add(sessionId);
      return true;
    }
  }
  return false;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function comparePassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication Middleware
 * Checks Bearer token in headers or query or cookies, and validates session status
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const c of cookies) {
      const [name, val] = c.trim().split('=');
      if (name === 'token') {
        token = val;
        break;
      }
    }
  }

  if (!token) {
    const msg = req.t ? req.t('auth.unauthorized') : 'Token otentikasi tidak ditemukan. Silakan login kembali.';
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: msg
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    const msg = req.t ? req.t('auth.invalidToken') : 'Sesi login telah kedaluwarsa atau tidak valid.';
    return res.status(401).json({
      success: false,
      error: 'Invalid Token',
      message: msg
    });
  }

  // Check if session has been revoked via email or admin or concurrent login on another browser
  if (decoded.sessionId) {
    const isRevoked = await isSessionRevoked(decoded.sessionId);
    if (isRevoked) {
      // Also ensure session is removed from Redis
      await removeSessionFromRedis(decoded.sessionId);
      const msg = req.t ? req.t('auth.sessionRevoked') : 'Sesi login Anda telah dikeluarkan karena akun Anda telah berhasil login di browser lain.';
      return res.status(401).json({
        success: false,
        error: 'SessionRevoked',
        message: msg
      });
    }
  }

  // Single-session policy: verify this token is the currently active token for the user
  if (decoded.email) {
    const currentActiveToken = await getActiveTokenForUser(decoded.email);
    if (currentActiveToken && currentActiveToken !== token) {
      if (decoded.sessionId) {
        revokedSessionIds.add(decoded.sessionId);
        await removeSessionFromRedis(decoded.sessionId);
      }
      const msg = req.t ? req.t('auth.sessionRevoked') : 'Sesi login Anda telah dikeluarkan karena akun Anda telah berhasil login di browser lain.';
      return res.status(401).json({
        success: false,
        error: 'SessionRevoked',
        message: msg
      });
    }
  }

  // Validate active session in Redis on EVERY request
  // Synchronized with client-side idleTimedOut (15 minutes idle timeout)
  const redisSession = await getSessionFromRedis(token, true);
  if (!redisSession) {
    // Check if session was revoked due to another login before treating as idle timeout
    const isRevoked = decoded.sessionId ? await isSessionRevoked(decoded.sessionId) : false;
    if (isRevoked) {
      const msg = req.t ? req.t('auth.sessionRevoked') : 'Sesi login Anda telah dikeluarkan karena akun Anda telah berhasil login di browser lain.';
      return res.status(401).json({
        success: false,
        error: 'SessionRevoked',
        message: msg
      });
    }

    const msg = req.t ? req.t('auth.sessionTimedOut') : 'Sesi Anda telah berakhir otomatis karena 15 menit tanpa aktivitas.';
    return res.status(401).json({
      success: false,
      error: 'SessionTimedOut',
      idleTimedOut: true,
      message: msg
    });
  }

  req.user = decoded;
  next();
}

/**
 * Manager-only role authorization middleware (also accessible by ADMIN)
 */
export function requireManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    const msg = req.t ? req.t('auth.unauthorized') : 'Autentikasi diperlukan.';
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: msg
    });
  }

  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    const msg = req.t ? req.t('auth.managerOnly') : 'Akses ditolak. Fitur ini khusus untuk role MANAGER.';
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: msg
    });
  }

  next();
}

/**
 * Admin-only role authorization middleware (strictly for ADMIN)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    const msg = req.t ? req.t('auth.unauthorized') : 'Autentikasi diperlukan.';
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: msg
    });
  }

  if (req.user.role !== 'ADMIN') {
    const msg = req.t ? req.t('auth.adminOnly') : 'Akses ditolak. Halaman dan fitur ini hanya dapat diakses oleh role ADMIN.';
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: msg
    });
  }

  next();
}
