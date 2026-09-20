import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDB, fallbackStore } from '../db';
import { comparePassword, hashPassword, signToken, authMiddleware, revokedSessionIds, verifyToken } from '../auth';
import { sendLoginAlertEmail, sendLoginHistoryReportEmail, parseUserAgent } from '../mail';
import { ObjectId } from 'mongodb';
import { saveSessionToRedis, removeSessionFromRedis, refreshSessionActivity, isSessionActiveInRedis, invalidateUserSessionInStore } from '../sessionStore';
import { recordActivityLog } from '../activityLogger';
import { getAllVendors } from '../vendorMiddleware';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid').optional(),
  password: z.string().min(4, 'Password minimal 4 karakter').optional(),
  pin: z.string().length(6, 'PIN harus 6 digit angka').optional(),
  forceLogout: z.boolean().optional(),
  managerPin: z.string().length(6, 'PIN Manager harus 6 digit angka').optional()
}).refine(data => (data.email && data.password) || data.pin, {
  message: 'Harap masukkan email dan password, atau gunakan PIN 6 digit'
});

// Helper to get active sessions for a user
export async function getActiveSessionsForUser(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDB();
  let sessions: any[] = [];

  if (db) {
    try {
      sessions = await db.collection('login_history')
        .find({ email: normalizedEmail, status: 'ACTIVE' })
        .sort({ timestamp: -1 })
        .toArray();
    } catch (e) {}
  }

  if (!sessions || sessions.length === 0) {
    sessions = fallbackStore.login_history.filter(
      h => h.email.toLowerCase() === normalizedEmail && h.status === 'ACTIVE'
    );
  }

  // Filter out any sessions that are already recorded in revokedSessionIds
  const nonRevoked = sessions.filter(s => !revokedSessionIds.has(s.sessionId));
  
  // Verify with Redis: if session expired from Redis due to 15m idle timeout, mark it as TIMED_OUT/inactive
  const activeInRedis: any[] = [];
  for (const s of nonRevoked) {
    const isActive = await isSessionActiveInRedis(s.sessionId);
    if (isActive) {
      activeInRedis.push(s);
    }
  }

  return activeInRedis;
}

// Helper to revoke all active sessions for a user
export async function revokeAllActiveSessionsForUser(email: string, revokedBy: string, reason: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDB();
  const now = new Date();

  // 1. Invalidate in session store (Redis user mappings and in-memory caches)
  await invalidateUserSessionInStore(normalizedEmail);

  // 2. Query all active sessions from DB & fallback store
  let allActiveSessions: any[] = [];
  if (db) {
    try {
      allActiveSessions = await db.collection('login_history')
        .find({ email: normalizedEmail, status: 'ACTIVE' })
        .toArray();
    } catch (e) {}
  }
  if (!allActiveSessions || allActiveSessions.length === 0) {
    allActiveSessions = fallbackStore.login_history.filter(
      h => h.email.toLowerCase() === normalizedEmail && h.status === 'ACTIVE'
    );
  }

  const redisActive = await getActiveSessionsForUser(normalizedEmail);
  const combined = [...allActiveSessions, ...redisActive];
  const uniqueSessionIds = new Set<string>();

  for (const s of combined) {
    if (s.sessionId && !uniqueSessionIds.has(s.sessionId)) {
      uniqueSessionIds.add(s.sessionId);
      revokedSessionIds.add(s.sessionId);
      if (!fallbackStore.revoked_sessions.includes(s.sessionId)) {
        fallbackStore.revoked_sessions.push(s.sessionId);
      }
      removeSessionFromRedis(s.sessionId).catch(() => {});
    }
  }

  const update = {
    status: 'REVOKED',
    revokedAt: now,
    revokedBy,
    revokeReason: reason
  };

  if (db) {
    try {
      await db.collection('login_history').updateMany(
        { email: normalizedEmail, status: 'ACTIVE' },
        { $set: update }
      );
    } catch (e) {}
  }

  for (const item of fallbackStore.login_history) {
    if (item.email.toLowerCase() === normalizedEmail && item.status === 'ACTIVE') {
      Object.assign(item, update);
    }
  }

  return uniqueSessionIds.size;
}

// Helper to find manager by 6-digit PIN
export async function findManagerByPin(pin: string) {
  const db = getDB();
  let manager: any = null;

  if (db) {
    try {
      manager = await db.collection('users').findOne({
        role: 'MANAGER',
        $or: [
          { pin: pin },
          ...(pin === '123456' ? [{ pin: '1234' }] : [])
        ]
      });
    } catch (e) {}
  }

  if (!manager) {
    manager = fallbackStore.users.find(u => {
      if (u.role !== 'MANAGER') return false;
      const userPin = (u.pin === '1234') ? '123456' : u.pin;
      return userPin === pin;
    });
  }

  return manager;
}

// Lockout store in memory (persisting across requests)
interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null; // timestamp in ms
  lastAttemptAt: number;
}

const lockoutMap = new Map<string, LockoutRecord>();
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout
const MAX_FAILED_ATTEMPTS = 3;

function getLockoutKey(email?: string, ip?: string): string {
  if (email && email.trim()) {
    return `email_${email.trim().toLowerCase()}`;
  }
  return `ip_${ip || 'unknown'}`;
}

function checkUserLockout(email?: string, ip?: string) {
  const key = getLockoutKey(email, ip);
  const now = Date.now();
  const record = lockoutMap.get(key);

  if (!record) {
    return {
      isLocked: false,
      lockedUntil: null,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS
    };
  }

  // If locked but 15 minutes have passed, unlock and reset!
  if (record.lockedUntil && record.lockedUntil <= now) {
    record.failedAttempts = 0;
    record.lockedUntil = null;
    lockoutMap.set(key, record);
    return {
      isLocked: false,
      lockedUntil: null,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS
    };
  }

  // If currently locked
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      lockedUntil: record.lockedUntil,
      remainingSeconds,
      failedAttempts: record.failedAttempts,
      attemptsRemaining: 0
    };
  }

  return {
    isLocked: false,
    lockedUntil: null,
    remainingSeconds: 0,
    failedAttempts: record.failedAttempts,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts)
  };
}

function recordUserFailedAttempt(email?: string, ip?: string) {
  const key = getLockoutKey(email, ip);
  const now = Date.now();
  let record = lockoutMap.get(key);

  if (!record || (record.lockedUntil && record.lockedUntil <= now)) {
    record = { failedAttempts: 0, lockedUntil: null, lastAttemptAt: now };
  }

  record.failedAttempts += 1;
  record.lastAttemptAt = now;

  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    lockoutMap.set(key, record);
    return {
      isLocked: true,
      lockedUntil: record.lockedUntil,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      failedAttempts: record.failedAttempts,
      attemptsRemaining: 0
    };
  }

  lockoutMap.set(key, record);
  return {
    isLocked: false,
    lockedUntil: null,
    remainingSeconds: 0,
    failedAttempts: record.failedAttempts,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts)
  };
}

function clearUserLockout(email?: string, ip?: string) {
  const key = getLockoutKey(email, ip);
  lockoutMap.delete(key);
}

/**
 * GET /api/auth/lockout-status
 */
authRouter.get('/lockout-status', (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email : undefined;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : (req.socket.remoteAddress || '127.0.0.1');

  const status = checkUserLockout(email, ip);
  return res.json({ success: true, ...status });
});

const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  avatar: z.string().refine(
    val => !val || val === '' || val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'),
    'Format avatar harus berupa URL atau data gambar yang valid'
  ).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter').optional()
});

/**
 * GET /api/auth/selectable-users
 * Returns available users (without password hash) for quick user selection on login screen
 */
authRouter.get('/selectable-users', async (req: Request, res: Response) => {
  try {
    const db = getDB();
    let usersList: any[] = [];
    const vendors = await getAllVendors();
    const vendorMap = new Map(vendors.map(v => [v.id, v]));

    if (db) {
      try {
        const cursor = db.collection('users').find({}, { projection: { password: 0 } });
        usersList = await cursor.toArray();
      } catch (e) {
        // Fallback
      }
    }

    if (!usersList || usersList.length === 0) {
      usersList = fallbackStore.users.map(({ password, ...rest }) => rest);
    }

    const safeUsers = usersList.map(u => {
      let pin = u.pin;
      if (pin === '1234') pin = '123456';
      else if (pin === '8492') pin = '849201';
      else if (!pin) pin = '123456';

      const vId = u.vendorId || 'vnd_sipspot_central';
      const vendor = vendorMap.get(vId);

      return {
        id: u._id ? u._id.toString() : (u.id || u.email),
        name: u.name || 'Staff POS',
        email: u.email,
        role: u.role || 'CASHIER',
        avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        pin,
        vendorId: vId,
        vendorName: vendor?.name || 'SipSpot Coffee & Boba (Pusat)',
        vendorCode: vendor?.code || 'SIPSPOT'
      };
    });

    return res.json({
      success: true,
      vendors: vendors.map(v => ({
        id: v.id,
        name: v.name,
        code: v.code,
        clientId: v.clientId,
        status: v.status
      })),
      users: safeUsers
    });
  } catch (err: any) {
    console.error('[Auth] Error fetching selectable users:', err);
    return res.status(500).json({
      success: false,
      error: 'Server Error',
      message: 'Gagal mengambil daftar pengguna.'
    });
  }
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { email, password, pin } = parsed.data;
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.socket.remoteAddress || '127.0.0.1');

    // Check Lockout before processing credentials
    const currentLockout = checkUserLockout(email, ipAddress);
    if (currentLockout.isLocked) {
      const remMin = Math.ceil(currentLockout.remainingSeconds / 60);
      return res.status(423).json({
        success: false,
        error: 'Account Locked',
        isLocked: true,
        lockedUntil: currentLockout.lockedUntil,
        remainingSeconds: currentLockout.remainingSeconds,
        failedAttempts: currentLockout.failedAttempts,
        attemptsRemaining: 0,
        message: `Akun Anda terkunci selama 15 menit karena 3 kali gagal login. Silakan coba lagi dalam ${remMin} menit.`
      });
    }

    const db = getDB();
    let user: any = null;

    if (db) {
      try {
        if (pin) {
          if (email) {
            user = await db.collection('users').findOne({ email: email.toLowerCase() });
            // Check matching pin
            if (user && user.pin !== pin) {
              // Backward compatibility for 4-digit legacy
              if (!(user.pin === '1234' && pin === '123456') && !(user.pin === '8492' && pin === '849201')) {
                user = null;
              }
            }
          } else {
            user = await db.collection('users').findOne({ pin });
            if (!user && pin === '123456') {
              user = await db.collection('users').findOne({ pin: '1234' });
            } else if (!user && pin === '849201') {
              user = await db.collection('users').findOne({ pin: '8492' });
            }
          }
        } else if (email) {
          user = await db.collection('users').findOne({ email: email.toLowerCase() });
        }
      } catch (err) {
        // Fallback to local
      }
    }

    // Check fallback store if not found in db
    if (!user) {
      if (pin) {
        if (email) {
          const u = fallbackStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
          if (u) {
            const userPin = (u.pin === '1234') ? '123456' : (u.pin === '8492' ? '849201' : u.pin);
            if (userPin === pin) {
              user = u;
            }
          }
        } else {
          user = fallbackStore.users.find(u => {
            const userPin = (u.pin === '1234') ? '123456' : (u.pin === '8492' ? '849201' : u.pin);
            return userPin === pin;
          });
        }
      } else if (email) {
        user = fallbackStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
      }
    }

    if (!user) {
      const failStatus = recordUserFailedAttempt(email, ipAddress);
      if (failStatus.isLocked) {
        return res.status(423).json({
          success: false,
          error: 'Account Locked',
          isLocked: true,
          lockedUntil: failStatus.lockedUntil,
          remainingSeconds: failStatus.remainingSeconds,
          failedAttempts: failStatus.failedAttempts,
          attemptsRemaining: 0,
          message: 'Akun Anda telah terkunci selama 15 menit karena 3 kali gagal login. Silakan coba lagi nanti.'
        });
      }

      const msg = pin
        ? `PIN salah. Percobaan gagal: ${failStatus.failedAttempts}/3. Sisa ${failStatus.attemptsRemaining} kesempatan sebelum akun terkunci 15 menit.`
        : `Email atau akun tidak ditemukan. Percobaan gagal: ${failStatus.failedAttempts}/3. Sisa ${failStatus.attemptsRemaining} kesempatan.`;

      return res.status(401).json({
        success: false,
        error: 'Invalid Credentials',
        isLocked: false,
        failedAttempts: failStatus.failedAttempts,
        attemptsRemaining: failStatus.attemptsRemaining,
        message: msg
      });
    }

    // If logging in via password
    if (email && password) {
      const match = await comparePassword(password, user.password);
      if (!match) {
        const failStatus = recordUserFailedAttempt(email, ipAddress);
        if (failStatus.isLocked) {
          return res.status(423).json({
            success: false,
            error: 'Account Locked',
            isLocked: true,
            lockedUntil: failStatus.lockedUntil,
            remainingSeconds: failStatus.remainingSeconds,
            failedAttempts: failStatus.failedAttempts,
            attemptsRemaining: 0,
            message: 'Akun Anda telah terkunci selama 15 menit karena 3 kali gagal login. Silakan coba lagi nanti.'
          });
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid Credentials',
          isLocked: false,
          failedAttempts: failStatus.failedAttempts,
          attemptsRemaining: failStatus.attemptsRemaining,
          message: `Password salah. Percobaan gagal: ${failStatus.failedAttempts}/3. Sisa ${failStatus.attemptsRemaining} kesempatan sebelum akun terkunci 15 menit.`
        });
      }
    }

    // Authentication Succeeded -> Clear Lockout!
    clearUserLockout(user.email, ipAddress);

    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
    const loginMethod: 'PIN' | 'PASSWORD' = pin ? 'PIN' : 'PASSWORD';
    const device = parseUserAgent(userAgent);

    // SINGLE ACTIVE BROWSER POLICY:
    // User can only be active in ONE browser at a time.
    // If user is currently logged in on another browser/device, force logout all previous sessions upon successful login.
    const activeSessions = await getActiveSessionsForUser(user.email);
    let previousSessionsTerminated = 0;
    if (activeSessions.length > 0) {
      previousSessionsTerminated = await revokeAllActiveSessionsForUser(
        user.email,
        user.name,
        `Dipaksa logout otomatis karena akun berhasil login di browser/perangkat baru (${device})`
      );
    }

    const userId = user._id ? user._id.toString() : (user.id || 'mock_id');
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const revokeToken = crypto.randomBytes(24).toString('hex');

    const historyVendorId = (user as any).vendorId || req.vendorId || 'vnd_sipspot_central';
    const token = signToken({
      userId,
      email: user.email,
      role: user.role,
      name: user.name,
      sessionId,
      vendorId: historyVendorId
    });

    // Record login in history collection
    const historyEntry = {
      vendorId: historyVendorId,
      sessionId,
      userId,
      email: user.email,
      name: user.name,
      role: user.role,
      loginMethod,
      ipAddress,
      userAgent,
      device,
      status: 'ACTIVE' as const,
      timestamp: new Date(),
      revokeToken,
      revokedAt: null as Date | null,
      revokeReason: null as string | null
    };

    if (db) {
      try {
        await db.collection('login_history').insertOne(historyEntry);
      } catch (e) {
        fallbackStore.login_history.unshift(historyEntry);
      }
    } else {
      fallbackStore.login_history.unshift(historyEntry);
    }

    // Send login notification email with one-click remote logout link
    const appUrl = (req.headers.origin as string) || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `http://${req.headers.host}`);
    sendLoginAlertEmail({
      recipientEmail: user.email,
      userName: user.name,
      role: user.role,
      loginMethod,
      ipAddress,
      userAgent,
      device,
      sessionId,
      revokeToken,
      appUrl
    }).catch(err => {
      console.warn('[Auth] Async login email notification warning:', err.message);
    });

    // Store active session metadata in Redis with 15-minute idle timeout
    await saveSessionToRedis(token, {
      sessionId,
      token,
      userId,
      email: user.email,
      role: user.role,
      name: user.name,
      loginMethod,
      device,
      ipAddress,
      userAgent,
      createdAt: Date.now(),
      lastActive: Date.now()
    });

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({
      success: true,
      message: previousSessionsTerminated > 0
        ? `Selamat bertugas, ${user.name}! Sesi login di browser lain telah otomatis dipaksa keluar.`
        : `Selamat bertugas, ${user.name}!`,
      token,
      sessionId,
      previousSessionsTerminated: previousSessionsTerminated > 0,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        pin: user.pin,
        vendorId: historyVendorId
      }
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'Server Error',
      message: 'Terjadi kesalahan saat memproses login.'
    });
  }
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user!;
    const db = getDB();
    let user: any = null;

    if (db) {
      try {
        const query = ObjectId.isValid(userPayload.userId)
          ? { _id: new ObjectId(userPayload.userId) }
          : { email: userPayload.email };
        user = await db.collection('users').findOne(query);
      } catch (e) {
        // Fallback
      }
    }

    if (!user) {
      user = fallbackStore.users.find(u => u.email === userPayload.email);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Pengguna tidak ditemukan.'
      });
    }

    const resolvedVendorId = user.vendorId || userPayload.vendorId || 'vnd_sipspot_central';

    return res.json({
      success: true,
      user: {
        id: user._id ? user._id.toString() : userPayload.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        pin: user.pin,
        vendorId: resolvedVendorId
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * PUT /api/auth/profile
 */
authRouter.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: parsed.error.format()
      });
    }

    const { name, avatar, currentPassword, newPassword } = parsed.data;
    const userPayload = req.user!;
    const db = getDB();

    let user: any = null;
    if (db) {
      try {
        const query = ObjectId.isValid(userPayload.userId)
          ? { _id: new ObjectId(userPayload.userId) }
          : { email: userPayload.email };
        user = await db.collection('users').findOne(query);
      } catch (e) {
        // Fallback
      }
    }
    if (!user) {
      user = fallbackStore.users.find(u => u.email === userPayload.email);
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Password change check
    let updatedHashedPassword = user.password;
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Password saat ini diperlukan untuk mengubah password.'
        });
      }
      const match = await comparePassword(currentPassword, user.password);
      if (!match) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Password',
          message: 'Password saat ini tidak sesuai.'
        });
      }
      updatedHashedPassword = await hashPassword(newPassword);
    }

    const updates: any = {
      name: name || user.name,
      avatar: avatar !== undefined ? avatar : user.avatar,
      password: updatedHashedPassword,
      updatedAt: new Date()
    };

    if (db) {
      try {
        const query = ObjectId.isValid(userPayload.userId)
          ? { _id: new ObjectId(userPayload.userId) }
          : { email: userPayload.email };
        await db.collection('users').updateOne(query, { $set: updates });
      } catch (e) {
        // Fallback
      }
    }

    // Update in fallback store too
    const fallbackIdx = fallbackStore.users.findIndex(u => u.email === userPayload.email);
    if (fallbackIdx !== -1) {
      fallbackStore.users[fallbackIdx] = { ...fallbackStore.users[fallbackIdx], ...updates };
    }

    // Record system-wide activity log
    await recordActivityLog({
      action: 'UPDATE',
      entity: 'USER',
      entityId: userPayload.userId,
      entityName: updates.name,
      summary: `Pengguna '${updates.name}' memperbarui data profil${newPassword ? ' dan mengganti password' : ''}`,
      details: {
        userId: userPayload.userId,
        nameChanged: updates.name !== user.name,
        avatarChanged: updates.avatar !== user.avatar,
        passwordChanged: !!newPassword
      },
      req
    });

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui!',
      user: {
        id: userPayload.userId,
        email: user.email,
        name: updates.name,
        role: user.role,
        avatar: updates.avatar,
        pin: user.pin
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Server Error' });
  }
});

/**
 * GET /api/auth/check-session
 * Verify current session status (detects remote logout and validates Redis session)
 */
authRouter.get('/check-session', authMiddleware, (req: Request, res: Response) => {
  return res.json({
    success: true,
    active: true,
    sessionId: req.user?.sessionId,
    user: req.user
  });
});

/**
 * POST /api/auth/touch
 * Extend Redis session TTL on user activity (sliding window synchronized with idleTimedOut)
 */
authRouter.post('/touch', authMiddleware, (req: Request, res: Response) => {
  return res.json({
    success: true,
    active: true,
    sessionId: req.user?.sessionId,
    lastActive: Date.now()
  });
});

/**
 * POST /api/auth/logout
 * Marks current session as logged out
 */
authRouter.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  const sessionId = req.user?.sessionId;
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : undefined;

  if (sessionId) {
    await removeSessionFromRedis(sessionId);
    const db = getDB();
    if (db) {
      try {
        await db.collection('login_history').updateOne(
          { sessionId },
          { $set: { status: 'LOGGED_OUT', loggedOutAt: new Date() } }
        );
      } catch (e) {}
    }
    const local = fallbackStore.login_history.find(h => h.sessionId === sessionId);
    if (local) {
      local.status = 'LOGGED_OUT';
      local.loggedOutAt = new Date();
    }
  } else if (token) {
    await removeSessionFromRedis(token);
  }

  res.clearCookie('token');
  return res.json({ success: true, message: 'Berhasil logout' });
});

/**
 * GET /api/auth/login-history
 * Retrieve login history entries with filtering, pagination, and manager-only security
 */
authRouter.get('/login-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const scope = (req.query.scope as string) || (currentUser.role === 'MANAGER' ? 'all' : 'me');

    // Security check: Only manager/admin can view other users or all login history
    const isPrivileged = currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN';
    if (scope === 'all' && !isPrivileged) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Hanya manajer dan admin yang diizinkan untuk melihat semua riwayat login pengguna.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '15', 10)), 100);
    const skip = (page - 1) * limit;

    const search = (req.query.search as string || req.query.keyword as string || '').trim();
    const userFilter = (req.query.user as string || '').trim();
    const vendorQuery = (req.query.vendorId as string || '').trim();
    const isAllVendors = (req.query.allVendors === 'true' || vendorQuery === 'ALL' || vendorQuery === 'all' || (!vendorQuery && currentUser.role === 'ADMIN')) && (currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN');
    const dateFilter = (req.query.date as string || '').trim();
    const startDate = (req.query.startDate as string || '').trim();
    const endDate = (req.query.endDate as string || '').trim();
    const statusFilter = (req.query.status as string || '').trim().toUpperCase();

    // MongoDB query builder
    const andClauses: any[] = [];

    // Role / user constraint
    if (!isPrivileged || scope === 'me') {
      andClauses.push({
        $or: [{ userId: currentUser.userId }, { email: currentUser.email }]
      });
    } else if (userFilter && userFilter !== 'ALL') {
      andClauses.push({
        $or: [{ userId: userFilter }, { email: userFilter.toLowerCase() }]
      });
    }

    // Keyword search filter
    if (search) {
      const escaped = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      andClauses.push({
        $or: [
          { name: { $regex: regex } },
          { email: { $regex: regex } },
          { ipAddress: { $regex: regex } },
          { device: { $regex: regex } },
          { userAgent: { $regex: regex } },
          { sessionId: { $regex: regex } },
          { loginMethod: { $regex: regex } }
        ]
      });
    }

    // Date filter
    if (dateFilter) {
      const dStart = new Date(`${dateFilter}T00:00:00.000Z`);
      const dEnd = new Date(`${dateFilter}T23:59:59.999Z`);
      if (!isNaN(dStart.getTime()) && !isNaN(dEnd.getTime())) {
        andClauses.push({
          timestamp: { $gte: dStart, $lte: dEnd }
        });
      }
    } else if (startDate || endDate) {
      const dateCondition: any = {};
      if (startDate) {
        const s = new Date(`${startDate}T00:00:00.000Z`);
        if (!isNaN(s.getTime())) dateCondition.$gte = s;
      }
      if (endDate) {
        const e = new Date(`${endDate}T23:59:59.999Z`);
        if (!isNaN(e.getTime())) dateCondition.$lte = e;
      }
      if (Object.keys(dateCondition).length > 0) {
        andClauses.push({ timestamp: dateCondition });
      }
    }

    // Status filter
    if (statusFilter && statusFilter !== 'ALL') {
      andClauses.push({ status: statusFilter });
    }

    // Vendor partition filter
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    if (!isAllVendors) {
      if (vendorQuery && vendorQuery !== 'ALL' && vendorQuery !== 'all') {
        andClauses.push({ vendorId: vendorQuery });
      } else {
        andClauses.push(
          activeVendorId === 'vnd_sipspot_central'
            ? { $or: [{ vendorId: 'vnd_sipspot_central' }, { vendorId: { $exists: false } }, { vendorId: null }] }
            : { vendorId: activeVendorId }
        );
      }
    }

    const mongoFilter = andClauses.length > 0 ? { $and: andClauses } : {};

    const db = getDB();
    let history: any[] = [];
    let total = 0;
    let activeSessionsCount = 0;
    let revokedSessionsCount = 0;
    let uniqueUsersCount = 0;

    if (db) {
      try {
        const collection = db.collection('login_history');
        total = await collection.countDocuments(mongoFilter);

        history = await collection
          .find(mongoFilter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        // Calculate stats
        activeSessionsCount = await collection.countDocuments({ ...mongoFilter, status: 'ACTIVE' });
        revokedSessionsCount = await collection.countDocuments({ ...mongoFilter, status: 'REVOKED' });
        const distinctEmails = await collection.distinct('email', mongoFilter);
        uniqueUsersCount = distinctEmails.length;
      } catch (e) {
        // Fallback to local store
      }
    }

    if (!db || (history.length === 0 && total === 0)) {
      // Filter in-memory from fallbackStore.login_history
      let inMemoryList = fallbackStore.login_history.filter(item => {
        // Vendor partition filter
        if (!isAllVendors) {
          if (vendorQuery && vendorQuery !== 'ALL' && vendorQuery !== 'all') {
            if ((item.vendorId || 'vnd_sipspot_central') !== vendorQuery) return false;
          } else if ((item.vendorId || 'vnd_sipspot_central') !== activeVendorId) {
            return false;
          }
        }

        // Role / user filter
        if (!isPrivileged || scope === 'me') {
          if (item.userId !== currentUser.userId && item.email !== currentUser.email) return false;
        } else if (userFilter && userFilter !== 'ALL') {
          if (item.userId !== userFilter && item.email.toLowerCase() !== userFilter.toLowerCase()) return false;
        }

        // Search filter
        if (search) {
          const q = search.toLowerCase();
          const matches =
            (item.name && item.name.toLowerCase().includes(q)) ||
            (item.email && item.email.toLowerCase().includes(q)) ||
            (item.ipAddress && item.ipAddress.toLowerCase().includes(q)) ||
            (item.device && item.device.toLowerCase().includes(q)) ||
            (item.sessionId && item.sessionId.toLowerCase().includes(q)) ||
            (item.loginMethod && item.loginMethod.toLowerCase().includes(q));
          if (!matches) return false;
        }

        // Date filter
        if (dateFilter) {
          const itemDateStr = new Date(item.timestamp).toISOString().split('T')[0];
          if (itemDateStr !== dateFilter) return false;
        } else if (startDate || endDate) {
          const itemTime = new Date(item.timestamp).getTime();
          if (startDate && itemTime < new Date(`${startDate}T00:00:00.000Z`).getTime()) return false;
          if (endDate && itemTime > new Date(`${endDate}T23:59:59.999Z`).getTime()) return false;
        }

        // Status filter
        if (statusFilter && statusFilter !== 'ALL') {
          if (item.status !== statusFilter) return false;
        }

        return true;
      });

      // Sort by newest
      inMemoryList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      total = inMemoryList.length;
      activeSessionsCount = inMemoryList.filter(i => i.status === 'ACTIVE').length;
      revokedSessionsCount = inMemoryList.filter(i => i.status === 'REVOKED').length;
      uniqueUsersCount = new Set(inMemoryList.map(i => i.email)).size;

      history = inMemoryList.slice(skip, skip + limit);
    }

    const totalPages = Math.ceil(total / limit) || 1;

    // Check Redis session active status for history items
    const resolvedHistory = await Promise.all(
      history.map(async h => {
        let currentStatus = h.status;
        if (currentStatus === 'ACTIVE') {
          if (revokedSessionIds.has(h.sessionId)) {
            currentStatus = 'REVOKED';
          } else {
            const isActiveInRedis = await isSessionActiveInRedis(h.sessionId);
            if (!isActiveInRedis) {
              currentStatus = 'TIMED_OUT';
            }
          }
        }
        return {
          id: h._id ? h._id.toString() : (h.id || h.sessionId),
          sessionId: h.sessionId,
          userId: h.userId,
          email: h.email,
          name: h.name,
          role: h.role,
          loginMethod: h.loginMethod,
          ipAddress: h.ipAddress,
          userAgent: h.userAgent,
          device: h.device,
          status: currentStatus,
          timestamp: h.timestamp,
          revokedAt: h.revokedAt,
          revokeReason: h.revokeReason
        };
      })
    );

    return res.json({
      success: true,
      history: resolvedHistory,
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      stats: {
        totalLogins: total,
        activeSessions: resolvedHistory.filter(h => h.status === 'ACTIVE').length,
        revokedSessions: revokedSessionsCount,
        uniqueUsers: uniqueUsersCount
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/send-login-history
 * Manually trigger sending user's login history report to email
 */
authRouter.post('/send-login-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const targetEmail = req.body.email || currentUser.email;
    const activeVendorId = req.vendorId || (req as any).user?.vendorId || 'vnd_sipspot_central';
    const isSuperAdmin = currentUser.role === 'SUPERADMIN';

    const db = getDB();
    let history: any[] = [];
    if (db) {
      try {
        const query: any = { email: targetEmail };
        if (!isSuperAdmin) {
          query.vendorId = activeVendorId;
        }
        history = await db.collection('login_history')
          .find(query)
          .sort({ timestamp: -1 })
          .limit(20)
          .toArray();
      } catch (e) {}
    }

    if (!history || history.length === 0) {
      history = fallbackStore.login_history
        .filter(h => h.email === targetEmail && (isSuperAdmin || (h.vendorId || 'vnd_sipspot_central') === activeVendorId))
        .slice(0, 20);
    }

    const appUrl = (req.headers.origin as string) || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `http://${req.headers.host}`);

    const emailResult = await sendLoginHistoryReportEmail({
      recipientEmail: targetEmail,
      userName: currentUser.name,
      history,
      appUrl
    });

    if (emailResult.success) {
      return res.json({
        success: true,
        message: `Riwayat login berhasil dikirim ke ${targetEmail}!`
      });
    } else {
      return res.status(500).json({
        success: false,
        error: emailResult.error || 'Gagal mengirim email riwayat login',
        message: 'Gagal mengirim email riwayat login. Pastikan konfigurasi SMTP aktif.'
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/revoke-session
 * In-app endpoint to revoke an active session
 */
authRouter.post('/revoke-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const currentUser = req.user!;
    const { sessionId, reason } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID diperlukan' });
    }

    revokedSessionIds.add(sessionId);
    if (!fallbackStore.revoked_sessions.includes(sessionId)) {
      fallbackStore.revoked_sessions.push(sessionId);
    }
    await removeSessionFromRedis(sessionId);

    const db = getDB();
    const update = {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedBy: currentUser.email,
      revokeReason: reason || 'Dikeluarkan dari sistem oleh pengguna'
    };

    if (db) {
      try {
        await db.collection('login_history').updateOne(
          { sessionId },
          { $set: update }
        );
      } catch (e) {}
    }

    const localEntry = fallbackStore.login_history.find(h => h.sessionId === sessionId);
    if (localEntry) {
      Object.assign(localEntry, update);
    }

    return res.json({
      success: true,
      message: 'Sesi berhasil dikeluarkan dan dinonaktifkan!',
      sessionId
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/force-logout
 * Allows a Manager to force logout any active user session
 * Can be called with auth token (role MANAGER) OR with managerPin (e.g. from login screen)
 */
authRouter.post('/force-logout', async (req: Request, res: Response) => {
  try {
    const { targetEmail, sessionId, managerPin, reason } = req.body;

    if (!targetEmail && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Parameter targetEmail atau sessionId diperlukan'
      });
    }

    let isAuthorized = false;
    let managerName = 'Manager';
    let managerEmail = 'manager@sipspot.com';

    // 1. Check if authenticated via JWT token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      if (decoded && decoded.role === 'MANAGER') {
        isAuthorized = true;
        managerName = decoded.name;
        managerEmail = decoded.email;
      }
    }

    // 2. Check if authorized via managerPin (6-digit PIN)
    if (!isAuthorized && managerPin) {
      const mgr = await findManagerByPin(managerPin);
      if (mgr) {
        isAuthorized = true;
        managerName = mgr.name;
        managerEmail = mgr.email;
      } else {
        return res.status(403).json({
          success: false,
          error: 'InvalidManagerPin',
          message: 'PIN Manager tidak valid. Hanya role Manager yang dapat melakukan force logout.'
        });
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Akses ditolak. Fitur Force Logout hanya dapat dilakukan oleh role Manager.'
      });
    }

    const revokeReason = reason || `Dipaksa keluar oleh Manager (${managerName})`;

    // If specific sessionId requested
    if (sessionId) {
      revokedSessionIds.add(sessionId);
      if (!fallbackStore.revoked_sessions.includes(sessionId)) {
        fallbackStore.revoked_sessions.push(sessionId);
      }
      await removeSessionFromRedis(sessionId);
      const db = getDB();
      const update = {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: managerEmail,
        revokeReason
      };
      if (db) {
        try {
          await db.collection('login_history').updateOne(
            { sessionId },
            { $set: update }
          );
        } catch (e) {}
      }
      const local = fallbackStore.login_history.find(h => h.sessionId === sessionId);
      if (local) Object.assign(local, update);

      return res.json({
        success: true,
        message: `Sesi perangkat berhasil dipaksa logout oleh ${managerName}!`,
        sessionId
      });
    }

    // If targetEmail requested
    if (targetEmail) {
      const count = await revokeAllActiveSessionsForUser(targetEmail, managerEmail, revokeReason);
      return res.json({
        success: true,
        message: `Sesi aktif (${count} sesi) untuk ${targetEmail} berhasil dipaksa logout oleh ${managerName}!`,
        revokedCount: count
      });
    }

    return res.status(400).json({ success: false, message: 'Permintaan tidak valid' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/revoke-session
 * One-click remote logout URL from security notification email
 */
authRouter.get('/revoke-session', async (req: Request, res: Response) => {
  const { token, session } = req.query;

  if (!token || !session || typeof token !== 'string' || typeof session !== 'string') {
    return res.status(400).send(renderRevokeHtml({
      status: 'invalid',
      title: 'Tautan Tidak Valid',
      message: 'Parameter keamanan tidak lengkap atau tautan sudah rusak.'
    }));
  }

  const db = getDB();
  let entry: any = null;

  if (db) {
    try {
      entry = await db.collection('login_history').findOne({ sessionId: session });
    } catch (e) {}
  }

  if (!entry) {
    entry = fallbackStore.login_history.find(h => h.sessionId === session);
  }

  if (!entry) {
    return res.status(404).send(renderRevokeHtml({
      status: 'not_found',
      title: 'Sesi Tidak Ditemukan',
      message: 'Sesi login ini tidak ditemukan dalam catatan sistem.'
    }));
  }

  // Check token match
  if (entry.revokeToken !== token) {
    return res.status(403).send(renderRevokeHtml({
      status: 'unauthorized',
      title: 'Akses Ditolak',
      message: 'Kunci otorisasi keamanan tidak cocok atau tidak sah.'
    }));
  }

  // If already revoked
  if (entry.status === 'REVOKED') {
    return res.send(renderRevokeHtml({
      status: 'already_revoked',
      title: 'Sesi Sudah Pernah Dikeluarkan',
      message: `Sesi login pada perangkat (${entry.device || 'Perangkat Kasir'}) sudah dinonaktifkan sebelumnya pada ${new Date(entry.revokedAt).toLocaleString('id-ID')}.`,
      entry
    }));
  }

  // Revoke session
  revokedSessionIds.add(session);
  if (!fallbackStore.revoked_sessions.includes(session)) {
    fallbackStore.revoked_sessions.push(session);
  }

  const update = {
    status: 'REVOKED',
    revokedAt: new Date(),
    revokeReason: 'Dikeluarkan dari jauh melalui tautan keamanan email'
  };

  if (db) {
    try {
      await db.collection('login_history').updateOne(
        { sessionId: session },
        { $set: update }
      );
    } catch (e) {}
  }

  if (entry) {
    Object.assign(entry, update);
  }

  return res.send(renderRevokeHtml({
    status: 'success',
    title: 'Sesi Berhasil Dikeluarkan & Akun Telah Diamankan!',
    message: `Akses perangkat (${entry.device || 'Perangkat Kasir'}) untuk akun ${entry.name} (${entry.email}) telah diputus seketika. Perangkat tersebut telah dipaksa logout dari sistem SipSpot POS.`,
    entry
  }));
});

function renderRevokeHtml(params: {
  status: 'success' | 'already_revoked' | 'invalid' | 'not_found' | 'unauthorized';
  title: string;
  message: string;
  entry?: any;
}) {
  const isSuccess = params.status === 'success';
  const isAlready = params.status === 'already_revoked';

  const badgeBg = isSuccess ? '#dcfce7' : isAlready ? '#fef3c7' : '#fee2e2';
  const badgeColor = isSuccess ? '#15803d' : isAlready ? '#b45309' : '#b91c1c';
  const icon = isSuccess ? '🛡️' : isAlready ? '⚠️' : '❌';

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title} - SipSpot POS Security</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fff8f6; color: #221a18; margin: 0; padding: 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background-color: #ffffff; max-width: 520px; width: 100%; border-radius: 24px; padding: 32px 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #f2dfdc; text-align: center; }
    .icon-badge { width: 68px; height: 68px; border-radius: 20px; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 800; color: #1c1917; margin: 0 0 10px 0; }
    p { font-size: 14px; line-height: 1.6; color: #57534e; margin: 0 0 20px 0; }
    .details-box { background-color: #fdfaf9; border: 1px solid #f5e4e1; border-radius: 14px; padding: 16px; margin: 20px 0; text-align: left; font-size: 13px; }
    .details-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5e4e1; }
    .details-row:last-child { border-bottom: none; }
    .details-label { color: #78716c; }
    .details-val { font-weight: 600; color: #1c1917; }
    .btn { display: inline-block; background-color: #ae3115; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 12px; transition: background-color 0.2s; }
    .btn:hover { background-color: #922810; }
    .footer { font-size: 12px; color: #a8a29e; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">${icon}</div>
    <h1>${params.title}</h1>
    <p>${params.message}</p>

    ${
      params.entry
        ? `
      <div class="details-box">
        <div class="details-row">
          <span class="details-label">Pengguna Akun</span>
          <span class="details-val">${params.entry.name} (${params.entry.role})</span>
        </div>
        <div class="details-row">
          <span class="details-label">Perangkat Diputus</span>
          <span class="details-val">${params.entry.device || 'Browser POS'}</span>
        </div>
        <div class="details-row">
          <span class="details-label">Alamat IP</span>
          <span class="details-val"><code>${params.entry.ipAddress || '-'}</code></span>
        </div>
        <div class="details-row">
          <span class="details-label">Status Sesi</span>
          <span class="details-val" style="color: #dc2626;">⛔ Akses Dicabut (Logged Out)</span>
        </div>
      </div>
    `
        : ''
    }

    <a href="/" class="btn">Buka Aplikasi SipSpot POS</a>
    <div class="footer">
      Sistem Keamanan Terpadu SipSpot POS • Sesi multi-perangkat terlindungi
    </div>
  </div>
</body>
</html>
  `;
}
