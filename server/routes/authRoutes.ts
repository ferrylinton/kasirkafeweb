import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getDB, fallbackStore } from '../db';
import { comparePassword, hashPassword, signToken, authMiddleware, requireAdmin, revokedSessionIds, verifyToken } from '../auth';
import { sendLoginAlertEmail, sendLoginHistoryReportEmail, parseUserAgent, sendPinResetEmail, sendAdminNewPinEmail } from '../mail';
import { ObjectId } from 'mongodb';
import { saveSessionToRedis, removeSessionFromRedis, refreshSessionActivity, isSessionActiveInRedis, invalidateUserSessionInStore } from '../sessionStore';
import { recordActivityLog } from '../activityLogger';
import { getAllVendors } from '../vendorMiddleware';
import { logLogin } from '../dailyRollingLogger';
import {
  checkUserLockout,
  recordUserFailedAttempt,
  clearUserLockout,
  getLockedUsersFromRedis,
  unlockUserInRedis,
  unlockAllUsersInRedis,
  lockUserManually,
  LOCKOUT_DURATION_MS
} from '../lockoutStore';
import { getRedisClient } from '../redis';

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

/**
 * GET /api/auth/lockout-status
 * Query lockout status for an email or IP (stored in Redis with fallback)
 */
authRouter.get('/lockout-status', async (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email : undefined;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : (req.socket.remoteAddress || '127.0.0.1');

  const status = await checkUserLockout(email, ip);
  return res.json({ success: true, ...status });
});

/**
 * GET /api/auth/admin/locked-users
 * Role ADMIN: Fetch all locked users from Redis
 */
authRouter.get('/admin/locked-users', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const lockedUsers = await getLockedUsersFromRedis();
    const redis = getRedisClient();
    return res.json({
      success: true,
      isRedisConnected: !!redis,
      source: redis ? 'redis' : 'fallback_memory',
      count: lockedUsers.length,
      lockedUsers
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch locked users',
      message: err?.message || 'Gagal memuat daftar pengguna terkunci dari Redis'
    });
  }
});

/**
 * POST /api/auth/admin/unlock-user
 * Role ADMIN: Unlock a user from Redis
 */
authRouter.post('/admin/unlock-user', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Identifier (email atau IP) diperlukan untuk membuka kunci'
      });
    }

    const adminEmail = req.user?.email || req.user?.name || 'ADMIN';
    const result = await unlockUserInRedis(identifier, adminEmail);

    recordActivityLog({
      action: 'UPDATE',
      entity: 'USER',
      entityName: identifier,
      summary: `Admin (${adminEmail}) membuka kunci lockout Redis untuk akun/IP: ${identifier}`,
      req,
      details: {
        unlockedIdentifier: identifier,
        unlockedBy: adminEmail,
        action: 'ADMIN_UNLOCK_USER'
      }
    }).catch(() => {});

    return res.json({
      success: true,
      message: result.message
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Unlock Failed',
      message: err?.message || 'Gagal membuka kunci pengguna di Redis'
    });
  }
});

/**
 * POST /api/auth/admin/unlock-all
 * Role ADMIN: Bulk unlock all locked users in Redis
 */
authRouter.post('/admin/unlock-all', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminEmail = req.user?.email || req.user?.name || 'ADMIN';
    const result = await unlockAllUsersInRedis(adminEmail);

    recordActivityLog({
      action: 'UPDATE',
      entity: 'USER',
      summary: `Admin (${adminEmail}) membuka kunci semua akun (${result.unlockedCount} akun) dari Redis lockout`,
      req,
      details: {
        unlockedCount: result.unlockedCount,
        unlockedBy: adminEmail,
        action: 'ADMIN_UNLOCK_ALL_USERS'
      }
    }).catch(() => {});

    return res.json({
      success: true,
      unlockedCount: result.unlockedCount,
      message: result.message
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Unlock All Failed',
      message: err?.message || 'Gagal membuka semua kunci pengguna di Redis'
    });
  }
});

/**
 * POST /api/auth/admin/lock-user
 * Role ADMIN: Manually lock a user in Redis (for testing or emergency administrative action)
 */
authRouter.post('/admin/lock-user', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { identifier, reason } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Identifier (email atau IP) diperlukan'
      });
    }

    const adminEmail = req.user?.email || req.user?.name || 'ADMIN';
    const lockStatus = await lockUserManually(identifier, reason || 'Dikunci manual oleh Admin', adminEmail);

    recordActivityLog({
      action: 'UPDATE',
      entity: 'USER',
      entityName: identifier,
      summary: `Admin (${adminEmail}) mengunci akun/IP: ${identifier} secara manual di Redis selama 15 menit`,
      req,
      details: {
        lockedIdentifier: identifier,
        lockedBy: adminEmail,
        reason: reason || 'Manual lock by Admin'
      }
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Akun/IP ${identifier} berhasil dikunci selama 15 menit di Redis.`,
      lockStatus
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Lock Failed',
      message: err?.message || 'Gagal mengunci pengguna di Redis'
    });
  }
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
    const currentLockout = await checkUserLockout(email, ipAddress);
    if (currentLockout.isLocked) {
      const remMin = Math.ceil(currentLockout.remainingSeconds / 60);
      logLogin({
        status: 'LOCKED',
        email,
        ipAddress,
        req,
        reason: `Akun masih terkunci selama ${remMin} menit karena percobaan login berulang`
      }).catch(() => {});

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
      const failReason = pin ? 'PIN kasir tidak cocok atau akun tidak ditemukan' : 'Email tidak terdaftar';
      const failStatus = await recordUserFailedAttempt(email, ipAddress, failReason);
      logLogin({
        status: failStatus.isLocked ? 'LOCKED' : 'FAILED',
        email,
        ipAddress,
        userAgent: req.headers['user-agent'] as string,
        req,
        loginMethod: pin ? 'PIN' : 'PASSWORD',
        reason: failReason
      }).catch(() => {});

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
        const failStatus = await recordUserFailedAttempt(email, ipAddress, 'Password akun salah');
        logLogin({
          status: failStatus.isLocked ? 'LOCKED' : 'FAILED',
          email: user.email,
          name: user.name,
          role: user.role,
          userId: user._id?.toString() || user.id,
          ipAddress,
          userAgent: req.headers['user-agent'] as string,
          req,
          loginMethod: 'PASSWORD',
          reason: 'Password akun salah'
        }).catch(() => {});

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
    await clearUserLockout(user.email, ipAddress);

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
      logLogin({
        status: 'REVOKED',
        email: user.email,
        name: user.name,
        role: user.role,
        userId: user._id ? user._id.toString() : (user.id || 'mock_id'),
        ipAddress,
        userAgent,
        req,
        reason: `Dipaksa logout otomatis karena akun berhasil login di browser/perangkat baru (${device})`
      }).catch(() => {});
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

    // Write login success to daily rolling log file!
    logLogin({
      status: 'SUCCESS',
      email: user.email,
      name: user.name,
      role: user.role,
      userId,
      vendorId: historyVendorId,
      ipAddress,
      userAgent,
      loginMethod,
      req,
      details: {
        sessionId,
        device,
        previousSessionsTerminated
      }
    }).catch(() => {});

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

  logLogin({
    status: 'LOGOUT',
    email: req.user?.email,
    name: req.user?.name,
    role: req.user?.role,
    userId: req.user?.userId,
    req,
    details: { sessionId }
  }).catch(() => {});

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
    const isPrivileged = currentUser.role === 'MANAGER' || currentUser.role === 'ADMIN';
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
    const isAllVendors = (req.query.allVendors === 'true' || vendorQuery === 'ALL' || vendorQuery === 'all' || (!vendorQuery && currentUser.role === 'ADMIN')) && (currentUser.role === 'ADMIN');
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

    const db = getDB();
    let history: any[] = [];
    if (db) {
      try {
        const query: any = { email: targetEmail };
        history = await db.collection('login_history')
          .find(query)
          .sort({ timestamp: -1 })
          .limit(20)
          .toArray();
      } catch (e) {}
    }

    if (!history || history.length === 0) {
      history = fallbackStore.login_history
        .filter(h => h.email === targetEmail && (h.vendorId || 'vnd_sipspot_central') === activeVendorId)
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

/**
 * Helper to find user by email across MongoDB and fallbackStore
 */
async function findUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const db = getDB();
  if (db) {
    try {
      const user = await db.collection('users').findOne({
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (user) return user;
    } catch (e) {
      console.warn('DB error findUserByEmail, falling back to store:', e);
    }
  }
  return fallbackStore.users.find(u => u.email && u.email.toLowerCase().trim() === normalizedEmail);
}

/**
 * Helper to update user PIN across MongoDB and fallbackStore
 */
async function updateUserPin(userIdOrEmail: string, newPin: string) {
  const db = getDB();
  const normalized = userIdOrEmail.toLowerCase().trim();
  
  // Update in fallback store
  const fallbackIndex = fallbackStore.users.findIndex(
    u => (u._id && u._id.toString() === userIdOrEmail) ||
         (u.id && u.id === userIdOrEmail) ||
         (u.email && u.email.toLowerCase().trim() === normalized)
  );
  if (fallbackIndex !== -1) {
    fallbackStore.users[fallbackIndex].pin = newPin;
    fallbackStore.users[fallbackIndex].updatedAt = new Date();
  }

  // Update in DB if available
  if (db) {
    try {
      let query: any = {
        email: { $regex: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      };
      if (ObjectId.isValid(userIdOrEmail)) {
        query = { _id: new ObjectId(userIdOrEmail) };
      }
      await db.collection('users').updateOne(
        query,
        { $set: { pin: newPin, updatedAt: new Date() } }
      );
    } catch (e) {
      console.warn('DB error updateUserPin:', e);
    }
  }
}

/**
 * -------------------------------------------------------------
 * FORGOT PIN & PIN RESET FLOW
 * -------------------------------------------------------------
 */

// 1. Request Reset PIN Link via Email (Check whether email exists!)
authRouter.post('/forgot-pin', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Alamat email wajib diisi.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Format alamat email tidak valid.'
      });
    }

    // CHECK WHETHER EMAIL EXISTS
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'EmailNotFound',
        message: 'Email tidak terdaftar dalam sistem SipSpot POS. Silakan periksa kembali email Anda atau hubungi Administrator.'
      });
    }

    // Generate secure token (valid for 60 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const tokenRecord = {
      id: 'prt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      token: resetToken,
      email: normalizedEmail,
      userId: user._id ? user._id.toString() : user.id,
      userName: user.name,
      expiresAt,
      createdAt: new Date(),
      used: false
    };

    const db = getDB();
    if (db) {
      try {
        await db.collection('pin_reset_tokens').insertOne(tokenRecord);
      } catch (e) {
        fallbackStore.pin_reset_tokens.unshift(tokenRecord);
      }
    } else {
      fallbackStore.pin_reset_tokens.unshift(tokenRecord);
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const resetUrl = `${protocol}://${host}/?action=reset-pin&token=${resetToken}`;

    // Send email with reset PIN link
    const mailResult = await sendPinResetEmail({
      recipientEmail: normalizedEmail,
      userName: user.name,
      resetToken,
      resetUrl,
      expiresInMinutes: 60
    });

    // Record activity log
    await recordActivityLog({
      action: 'FORGOT_PIN_REQUEST',
      entity: 'USER',
      entityId: user._id ? user._id.toString() : user.id,
      entityName: user.name,
      summary: `Pengguna ${user.name} (${normalizedEmail}) meminta tautan atur ulang PIN ke email`,
      user: {
        id: user._id ? user._id.toString() : user.id,
        name: user.name,
        email: normalizedEmail,
        role: user.role
      },
      details: { email: normalizedEmail, tokenCreated: true, mailSuccess: mailResult.success },
      req
    });

    return res.json({
      success: true,
      message: `Tautan atur ulang PIN telah berhasil dikirim ke ${normalizedEmail}. Silakan periksa kotak masuk atau spam email Anda.`,
      email: normalizedEmail,
      userName: user.name,
      resetUrl,
      token: resetToken
    });
  } catch (error: any) {
    console.error('Error in /api/auth/forgot-pin:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Gagal memproses permintaan reset PIN. Silakan coba beberapa saat lagi.'
    });
  }
});

// 2. Verify Reset PIN Token
authRouter.get('/reset-pin/verify', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token reset PIN tidak ditemukan.'
      });
    }

    const db = getDB();
    let tokenEntry: any = null;

    if (db) {
      try {
        tokenEntry = await db.collection('pin_reset_tokens').findOne({ token, used: false });
      } catch (e) {
        tokenEntry = fallbackStore.pin_reset_tokens.find(t => t.token === token && !t.used);
      }
    } else {
      tokenEntry = fallbackStore.pin_reset_tokens.find(t => t.token === token && !t.used);
    }

    if (!tokenEntry) {
      return res.status(400).json({
        success: false,
        message: 'Token reset PIN tidak valid atau sudah digunakan.'
      });
    }

    if (new Date(tokenEntry.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Token reset PIN sudah kedaluwarsa. Silakan ajukan permintaan reset PIN baru.'
      });
    }

    const user = await findUserByEmail(tokenEntry.email);
    const vendor = user ? fallbackStore.vendors.find(v => v.id === user.vendorId) : null;

    return res.json({
      success: true,
      email: tokenEntry.email,
      userName: user ? user.name : tokenEntry.userName,
      role: user ? user.role : 'CASHIER',
      vendorName: vendor ? vendor.name : 'SipSpot POS'
    });
  } catch (error: any) {
    console.error('Error in /api/auth/reset-pin/verify:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memverifikasi token reset PIN'
    });
  }
});

// 3. Confirm New PIN using Token
authRouter.post('/reset-pin/confirm', async (req: Request, res: Response) => {
  try {
    const { token, newPin } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Token reset PIN tidak disertakan.'
      });
    }

    if (!newPin || !/^\d{6}$/.test(String(newPin).trim())) {
      return res.status(400).json({
        success: false,
        message: 'PIN baru harus terdiri dari 6 digit angka.'
      });
    }

    const cleanPin = String(newPin).trim();

    const db = getDB();
    let tokenEntry: any = null;

    if (db) {
      try {
        tokenEntry = await db.collection('pin_reset_tokens').findOne({ token, used: false });
      } catch (e) {
        tokenEntry = fallbackStore.pin_reset_tokens.find(t => t.token === token && !t.used);
      }
    } else {
      tokenEntry = fallbackStore.pin_reset_tokens.find(t => t.token === token && !t.used);
    }

    if (!tokenEntry) {
      return res.status(400).json({
        success: false,
        message: 'Token reset PIN tidak valid atau sudah digunakan.'
      });
    }

    if (new Date(tokenEntry.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Token reset PIN sudah kedaluwarsa. Silakan ajukan permintaan reset PIN baru.'
      });
    }

    const user = await findUserByEmail(tokenEntry.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna akun tidak ditemukan.'
      });
    }

    // Update user PIN
    await updateUserPin(user._id ? user._id.toString() : user.id, cleanPin);

    // Mark token as used
    if (db) {
      try {
        await db.collection('pin_reset_tokens').updateOne({ token }, { $set: { used: true, usedAt: new Date() } });
      } catch (e) { }
    }
    const tokenIdx = fallbackStore.pin_reset_tokens.findIndex(t => t.token === token);
    if (tokenIdx !== -1) {
      fallbackStore.pin_reset_tokens[tokenIdx].used = true;
      fallbackStore.pin_reset_tokens[tokenIdx].usedAt = new Date();
    }

    // Auto unlock user in Redis lockout if locked
    await unlockUserInRedis(tokenEntry.email, 'SYSTEM_SELF_RESET_PIN');
    clearUserLockout(tokenEntry.email);

    // Record activity log
    await recordActivityLog({
      action: 'PIN_RESET_COMPLETED',
      entity: 'USER',
      entityId: user._id ? user._id.toString() : user.id,
      entityName: user.name,
      summary: `Pengguna ${user.name} (${tokenEntry.email}) berhasil mereset PIN 6 digit kasir melalui tautan email`,
      user: {
        id: user._id ? user._id.toString() : user.id,
        name: user.name,
        email: tokenEntry.email,
        role: user.role
      },
      details: { email: tokenEntry.email },
      req
    });

    return res.json({
      success: true,
      message: 'PIN baru 6 digit Anda berhasil disimpan! Silakan login kasir dengan PIN baru Anda.',
      email: tokenEntry.email,
      userName: user.name
    });
  } catch (error: any) {
    console.error('Error in /api/auth/reset-pin/confirm:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengatur ulang PIN baru.'
    });
  }
});

// 4. User requests reset PIN to role ADMIN (Check whether email exists!)
authRouter.post('/pin-reset-requests', async (req: Request, res: Response) => {
  try {
    const { email, note } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Alamat email wajib diisi.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'ValidationError',
        message: 'Format alamat email tidak valid.'
      });
    }

    // CHECK WHETHER EMAIL EXISTS
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'EmailNotFound',
        message: 'Email tidak terdaftar dalam sistem SipSpot POS. Permintaan reset PIN ke ADMIN hanya berlaku untuk akun yang telah terdaftar.'
      });
    }

    const vendor = fallbackStore.vendors.find(v => v.id === user.vendorId) || null;

    const requestRecord = {
      id: 'req_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: user._id ? user._id.toString() : user.id,
      email: normalizedEmail,
      name: user.name,
      role: user.role,
      vendorId: user.vendorId,
      vendorName: vendor ? vendor.name : 'SipSpot POS',
      note: note ? String(note).slice(0, 300) : 'Pengguna meminta reset PIN langsung ke role ADMIN',
      status: 'PENDING',
      requestedAt: new Date(),
      ipAddress: req.ip || req.socket.remoteAddress || '-'
    };

    const db = getDB();
    if (db) {
      try {
        await db.collection('pin_reset_requests').insertOne(requestRecord);
      } catch (e) {
        fallbackStore.pin_reset_requests.unshift(requestRecord);
      }
    } else {
      fallbackStore.pin_reset_requests.unshift(requestRecord);
    }

    await recordActivityLog({
      action: 'ADMIN_PIN_RESET_REQUESTED',
      entity: 'USER',
      entityId: user._id ? user._id.toString() : user.id,
      entityName: user.name,
      summary: `Pengguna ${user.name} (${normalizedEmail}) mengirimkan permintaan reset PIN ke Administrator`,
      user: {
        id: user._id ? user._id.toString() : user.id,
        name: user.name,
        email: normalizedEmail,
        role: user.role
      },
      details: { requestId: requestRecord.id, vendorId: user.vendorId, note: requestRecord.note },
      req
    });

    return res.json({
      success: true,
      message: 'Permintaan reset PIN telah berhasil dikirim ke Administrator. Role ADMIN akan memproses dan mengirimkan PIN baru ke email Anda.',
      requestId: requestRecord.id,
      user: {
        name: user.name,
        email: normalizedEmail,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Error in /api/auth/pin-reset-requests:', error);
    return res.status(500).json({
      success: false,
      error: 'ServerError',
      message: 'Gagal mengirimkan permintaan reset PIN ke Administrator.'
    });
  }
});

// 5. Admin: Get all PIN reset requests
authRouter.get('/admin/pin-reset-requests', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDB();
    let requests: any[] = [];
    if (db) {
      try {
        requests = await db.collection('pin_reset_requests').find().sort({ requestedAt: -1 }).toArray();
      } catch (e) {
        requests = [...fallbackStore.pin_reset_requests];
      }
    } else {
      requests = [...fallbackStore.pin_reset_requests];
    }

    requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    return res.json({
      success: true,
      requests
    });
  } catch (error: any) {
    console.error('Error fetching admin pin reset requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar permintaan reset PIN'
    });
  }
});

// 6. Admin: Generate and Send New PIN to User's Email
authRouter.post('/admin/send-new-pin', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, customPin, requestId } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Alamat email pengguna wajib diisi.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Pengguna dengan email tersebut tidak ditemukan dalam sistem.'
      });
    }

    // Generate or validate 6-digit PIN
    let newPin: string;
    if (customPin) {
      if (!/^\d{6}$/.test(String(customPin).trim())) {
        return res.status(400).json({
          success: false,
          message: 'PIN baru harus berupa 6 digit angka.'
        });
      }
      newPin = String(customPin).trim();
    } else {
      // Secure random 6-digit number
      newPin = crypto.randomInt(100000, 999999).toString();
    }

    // Update user PIN in database and fallback store
    await updateUserPin(user._id ? user._id.toString() : user.id, newPin);

    // Auto unlock if user was locked out
    await unlockUserInRedis(normalizedEmail, (req as any).user?.email || 'ADMIN');
    clearUserLockout(normalizedEmail);

    // Get vendor info
    const vendor = fallbackStore.vendors.find(v => v.id === user.vendorId) || null;

    // Send email to user with the new PIN
    const adminEmail = (req as any).user?.email || 'admin@sipspot.id';
    const adminName = (req as any).user?.name || 'Administrator Sistem';

    const mailResult = await sendAdminNewPinEmail({
      recipientEmail: normalizedEmail,
      userName: user.name,
      newPin,
      adminEmail,
      adminName,
      vendorName: vendor ? vendor.name : 'SipSpot POS'
    });

    // If requestId was passed or pending request exists, mark as COMPLETED
    const db = getDB();
    if (requestId) {
      if (db) {
        try {
          await db.collection('pin_reset_requests').updateOne(
            { id: requestId },
            {
              $set: {
                status: 'COMPLETED',
                processedAt: new Date(),
                processedBy: adminEmail,
                newPinSent: true
              }
            }
          );
        } catch (e) { }
      }
      const reqIdx = fallbackStore.pin_reset_requests.findIndex(r => r.id === requestId);
      if (reqIdx !== -1) {
        fallbackStore.pin_reset_requests[reqIdx].status = 'COMPLETED';
        fallbackStore.pin_reset_requests[reqIdx].processedAt = new Date();
        fallbackStore.pin_reset_requests[reqIdx].processedBy = adminEmail;
        fallbackStore.pin_reset_requests[reqIdx].newPinSent = true;
      }
    } else {
      // Mark any pending request for this email as COMPLETED
      if (db) {
        try {
          await db.collection('pin_reset_requests').updateMany(
            { email: normalizedEmail, status: 'PENDING' },
            {
              $set: {
                status: 'COMPLETED',
                processedAt: new Date(),
                processedBy: adminEmail,
                newPinSent: true
              }
            }
          );
        } catch (e) { }
      }
      fallbackStore.pin_reset_requests.forEach(r => {
        if (r.email === normalizedEmail && r.status === 'PENDING') {
          r.status = 'COMPLETED';
          r.processedAt = new Date();
          r.processedBy = adminEmail;
          r.newPinSent = true;
        }
      });
    }

    // Record activity log
    await recordActivityLog({
      action: 'ADMIN_SENT_NEW_PIN',
      entity: 'USER',
      entityId: user._id ? user._id.toString() : user.id,
      entityName: user.name,
      summary: `Role ADMIN (${adminEmail}) membuat dan mengirimkan PIN baru ke email pengguna ${user.name} (${normalizedEmail})`,
      user: {
        id: (req as any).user?.id || 'admin',
        name: adminName,
        email: adminEmail,
        role: 'ADMIN'
      },
      details: {
        targetUserEmail: normalizedEmail,
        targetUserName: user.name,
        vendorId: user.vendorId,
        requestId: requestId || null,
        mailSuccess: mailResult.success
      },
      req
    });

    return res.json({
      success: true,
      message: `PIN baru ${newPin} berhasil dibuat dan dikirimkan ke email ${normalizedEmail}!`,
      newPin,
      email: normalizedEmail,
      userName: user.name,
      mailSuccess: mailResult.success
    });
  } catch (error: any) {
    console.error('Error in /api/auth/admin/send-new-pin:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengirim PIN baru ke email pengguna.'
    });
  }
});
