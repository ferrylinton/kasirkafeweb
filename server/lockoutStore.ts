import { getRedisClient } from './redis';
import { getDB, fallbackStore } from './db';
import { logRedis } from './dailyRollingLogger';

export interface LockoutRecord {
  identifier: string; // email or ip_<ip>
  type: 'email' | 'ip';
  email?: string;
  ip?: string;
  failedAttempts: number;
  isLocked: boolean;
  lockedAt: number | null;
  lockedUntil: number | null; // timestamp in ms
  lastAttemptAt: number;
  reason?: string;
}

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil: number | null;
  remainingSeconds: number;
  failedAttempts: number;
  attemptsRemaining: number;
  identifier?: string;
}

export interface LockedUserDetail {
  identifier: string;
  type: 'email' | 'ip';
  email?: string;
  ip?: string;
  name?: string;
  role?: string;
  vendorId?: string;
  avatar?: string;
  failedAttempts: number;
  isLocked: boolean;
  lockedAt: number;
  lockedUntil: number;
  remainingSeconds: number;
  lastAttemptAt: number;
  reason: string;
  source: 'redis' | 'fallback_memory';
}

export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout duration
export const LOCKOUT_DURATION_SECONDS = 15 * 60; // 900 seconds
export const MAX_FAILED_ATTEMPTS = 3;

const REDIS_LOCKOUT_PREFIX = 'lockout:record:';
const REDIS_LOCKED_SET = 'lockout:locked_users';

// In-memory fallback store in case Redis is not configured or momentarily disconnected
const inMemoryLockouts = new Map<string, LockoutRecord>();
const inMemoryLockedSet = new Set<string>();

// Auto-cleanup expired in-memory entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of inMemoryLockouts.entries()) {
    if (record.lockedUntil && record.lockedUntil <= now) {
      inMemoryLockouts.delete(key);
      inMemoryLockedSet.delete(key);
    }
  }
}, 30 * 1000);

export function normalizeLockoutKey(email?: string, ip?: string): { key: string; type: 'email' | 'ip' } {
  if (email && email.trim()) {
    return { key: email.trim().toLowerCase(), type: 'email' };
  }
  return { key: `ip_${ip || 'unknown'}`, type: 'ip' };
}

/**
 * Check if user or IP is currently locked out in Redis (with fallback)
 */
export async function checkUserLockout(email?: string, ip?: string): Promise<LockoutStatus> {
  const { key } = normalizeLockoutKey(email, ip);
  const now = Date.now();
  const redis = getRedisClient();

  if (redis) {
    try {
      const redisKey = `${REDIS_LOCKOUT_PREFIX}${key}`;
      const raw = await redis.get(redisKey);
      if (raw) {
        const record: LockoutRecord = JSON.parse(raw);

        // If locked but 15 minutes have expired, unlock and delete from Redis
        if (record.lockedUntil && record.lockedUntil <= now) {
          await redis.del(redisKey);
          await redis.srem(REDIS_LOCKED_SET, key);
          inMemoryLockouts.delete(key);
          inMemoryLockedSet.delete(key);
          return {
            isLocked: false,
            lockedUntil: null,
            remainingSeconds: 0,
            failedAttempts: 0,
            attemptsRemaining: MAX_FAILED_ATTEMPTS,
            identifier: key
          };
        }

        // If currently locked
        if (record.isLocked && record.lockedUntil && record.lockedUntil > now) {
          const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
          return {
            isLocked: true,
            lockedUntil: record.lockedUntil,
            remainingSeconds,
            failedAttempts: record.failedAttempts,
            attemptsRemaining: 0,
            identifier: key
          };
        }

        // Failed attempts recorded but not yet locked (< 3 failed)
        return {
          isLocked: false,
          lockedUntil: null,
          remainingSeconds: 0,
          failedAttempts: record.failedAttempts,
          attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts),
          identifier: key
        };
      }
    } catch (err: any) {
      console.warn('[Redis Lockout] Warning reading lockout from Redis, checking fallback:', err?.message);
    }
  }

  // Fallback in-memory check
  const memRecord = inMemoryLockouts.get(key);
  if (!memRecord) {
    return {
      isLocked: false,
      lockedUntil: null,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
      identifier: key
    };
  }

  if (memRecord.lockedUntil && memRecord.lockedUntil <= now) {
    inMemoryLockouts.delete(key);
    inMemoryLockedSet.delete(key);
    return {
      isLocked: false,
      lockedUntil: null,
      remainingSeconds: 0,
      failedAttempts: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
      identifier: key
    };
  }

  if (memRecord.isLocked && memRecord.lockedUntil && memRecord.lockedUntil > now) {
    const remainingSeconds = Math.ceil((memRecord.lockedUntil - now) / 1000);
    return {
      isLocked: true,
      lockedUntil: memRecord.lockedUntil,
      remainingSeconds,
      failedAttempts: memRecord.failedAttempts,
      attemptsRemaining: 0,
      identifier: key
    };
  }

  return {
    isLocked: false,
    lockedUntil: null,
    remainingSeconds: 0,
    failedAttempts: memRecord.failedAttempts,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - memRecord.failedAttempts),
    identifier: key
  };
}

/**
 * Record a failed login attempt in Redis (with 15 minutes lockout on 3 failed attempts)
 */
export async function recordUserFailedAttempt(
  email?: string,
  ip?: string,
  reason?: string
): Promise<LockoutStatus> {
  const { key, type } = normalizeLockoutKey(email, ip);
  const now = Date.now();
  const redis = getRedisClient();

  let record: LockoutRecord | null = null;

  // 1. Try to read existing record from Redis
  if (redis) {
    try {
      const redisKey = `${REDIS_LOCKOUT_PREFIX}${key}`;
      const raw = await redis.get(redisKey);
      if (raw) {
        record = JSON.parse(raw);
      }
    } catch (err) {
      // Fallback
    }
  }

  // 2. Fallback to in-memory record if not retrieved from Redis
  if (!record) {
    record = inMemoryLockouts.get(key) || null;
  }

  // 3. Reset if expired
  if (!record || (record.lockedUntil && record.lockedUntil <= now)) {
    record = {
      identifier: key,
      type,
      email: email ? email.trim().toLowerCase() : undefined,
      ip,
      failedAttempts: 0,
      isLocked: false,
      lockedAt: null,
      lockedUntil: null,
      lastAttemptAt: now,
      reason
    };
  }

  // 4. Increment failed attempts
  record.failedAttempts += 1;
  record.lastAttemptAt = now;
  if (reason) record.reason = reason;

  // 5. Check if threshold reached (3 attempts -> 15 minutes lockout)
  if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    record.isLocked = true;
    record.lockedAt = now;
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    record.reason = reason || '3 kali gagal percobaan login';

    // Store in Redis with 15-minute TTL
    if (redis) {
      try {
        const redisKey = `${REDIS_LOCKOUT_PREFIX}${key}`;
        const pipeline = redis.pipeline();
        pipeline.set(redisKey, JSON.stringify(record), 'EX', LOCKOUT_DURATION_SECONDS);
        pipeline.sadd(REDIS_LOCKED_SET, key);
        await pipeline.exec();

        logRedis({
          event: 'RATE_LIMIT_EXCEEDED',
          message: `Pengguna/IP ${key} terkunci selama 15 menit di Redis akibat 3x gagal login.`,
          ipAddress: ip,
          details: {
            identifier: key,
            type,
            failedAttempts: record.failedAttempts,
            lockedUntil: record.lockedUntil
          }
        }).catch(() => {});
      } catch (err: any) {
        console.warn('[Redis Lockout] Warning setting lockout in Redis:', err?.message);
      }
    }

    // Update in-memory fallback
    inMemoryLockouts.set(key, record);
    inMemoryLockedSet.add(key);

    return {
      isLocked: true,
      lockedUntil: record.lockedUntil,
      remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
      failedAttempts: record.failedAttempts,
      attemptsRemaining: 0,
      identifier: key
    };
  }

  // Not locked yet (< 3 failed attempts)
  // Store with 15 minutes TTL so abandoned failed attempts expire
  if (redis) {
    try {
      const redisKey = `${REDIS_LOCKOUT_PREFIX}${key}`;
      await redis.set(redisKey, JSON.stringify(record), 'EX', LOCKOUT_DURATION_SECONDS);
    } catch (err: any) {
      console.warn('[Redis Lockout] Warning saving failed attempt to Redis:', err?.message);
    }
  }

  inMemoryLockouts.set(key, record);

  return {
    isLocked: false,
    lockedUntil: null,
    remainingSeconds: 0,
    failedAttempts: record.failedAttempts,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts),
    identifier: key
  };
}

/**
 * Clear lockout record upon successful authentication
 */
export async function clearUserLockout(email?: string, ip?: string): Promise<void> {
  const { key } = normalizeLockoutKey(email, ip);
  const redis = getRedisClient();

  if (redis) {
    try {
      const pipeline = redis.pipeline();
      pipeline.del(`${REDIS_LOCKOUT_PREFIX}${key}`);
      pipeline.srem(REDIS_LOCKED_SET, key);
      if (ip) {
        pipeline.del(`${REDIS_LOCKOUT_PREFIX}ip_${ip}`);
        pipeline.srem(REDIS_LOCKED_SET, `ip_${ip}`);
      }
      await pipeline.exec();
    } catch (err: any) {
      console.warn('[Redis Lockout] Warning clearing lockout in Redis:', err?.message);
    }
  }

  inMemoryLockouts.delete(key);
  inMemoryLockedSet.delete(key);
  if (ip) {
    inMemoryLockouts.delete(`ip_${ip}`);
    inMemoryLockedSet.delete(`ip_${ip}`);
  }
}

/**
 * Fetch all locked users from Redis (and in-memory fallback) for role ADMIN
 */
export async function getLockedUsersFromRedis(): Promise<LockedUserDetail[]> {
  const now = Date.now();
  const redis = getRedisClient();
  const lockedUsersMap = new Map<string, LockedUserDetail>();
  const db = getDB();

  // 1. Fetch from Redis if connected
  if (redis) {
    try {
      const redisLockedKeys = await redis.smembers(REDIS_LOCKED_SET);

      // Also scan keys just in case
      let scannedKeys: string[] = [];
      try {
        scannedKeys = await redis.keys(`${REDIS_LOCKOUT_PREFIX}*`);
      } catch (e) {
        // ignore scan error
      }

      const allTargetIdentifiers = new Set<string>(redisLockedKeys);
      for (const k of scannedKeys) {
        const id = k.replace(REDIS_LOCKOUT_PREFIX, '');
        if (id) allTargetIdentifiers.add(id);
      }

      for (const id of allTargetIdentifiers) {
        const redisKey = `${REDIS_LOCKOUT_PREFIX}${id}`;
        const raw = await redis.get(redisKey);
        if (!raw) {
          // Key expired in Redis, remove from Set
          await redis.srem(REDIS_LOCKED_SET, id);
          continue;
        }

        const record: LockoutRecord = JSON.parse(raw);

        // Check if expired
        if (record.lockedUntil && record.lockedUntil <= now) {
          await redis.del(redisKey);
          await redis.srem(REDIS_LOCKED_SET, id);
          continue;
        }

        if (record.isLocked && record.lockedUntil && record.lockedUntil > now) {
          const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
          lockedUsersMap.set(id, {
            identifier: id,
            type: record.type || (id.startsWith('ip_') ? 'ip' : 'email'),
            email: record.email || (!id.startsWith('ip_') ? id : undefined),
            ip: record.ip || (id.startsWith('ip_') ? id.replace('ip_', '') : undefined),
            failedAttempts: record.failedAttempts || MAX_FAILED_ATTEMPTS,
            isLocked: true,
            lockedAt: record.lockedAt || (record.lockedUntil - LOCKOUT_DURATION_MS),
            lockedUntil: record.lockedUntil,
            remainingSeconds: remainingSec,
            lastAttemptAt: record.lastAttemptAt || now,
            reason: record.reason || '3 kali gagal login (PIN/Password)',
            source: 'redis'
          });
        }
      }
    } catch (err: any) {
      console.warn('[Redis Lockout] Warning reading locked users from Redis:', err?.message);
    }
  }

  // 2. Complement with in-memory fallback entries
  for (const [key, memRecord] of inMemoryLockouts.entries()) {
    if (memRecord.lockedUntil && memRecord.lockedUntil <= now) {
      inMemoryLockouts.delete(key);
      inMemoryLockedSet.delete(key);
      continue;
    }

    if (memRecord.isLocked && memRecord.lockedUntil && memRecord.lockedUntil > now) {
      if (!lockedUsersMap.has(key)) {
        const remainingSec = Math.ceil((memRecord.lockedUntil - now) / 1000);
        lockedUsersMap.set(key, {
          identifier: key,
          type: memRecord.type,
          email: memRecord.email || (!key.startsWith('ip_') ? key : undefined),
          ip: memRecord.ip,
          failedAttempts: memRecord.failedAttempts,
          isLocked: true,
          lockedAt: memRecord.lockedAt || (memRecord.lockedUntil - LOCKOUT_DURATION_MS),
          lockedUntil: memRecord.lockedUntil,
          remainingSeconds: remainingSec,
          lastAttemptAt: memRecord.lastAttemptAt,
          reason: memRecord.reason || '3 kali gagal login (PIN/Password)',
          source: 'fallback_memory'
        });
      }
    }
  }

  const result = Array.from(lockedUsersMap.values());

  // 3. Enrich with user data (name, role, vendorId, avatar) from DB / fallbackStore
  for (const item of result) {
    if (item.email) {
      const emailLower = item.email.toLowerCase();
      let matchedUser: any = null;

      if (db) {
        try {
          matchedUser = await db.collection('users').findOne({ email: emailLower });
        } catch (e) {}
      }

      if (!matchedUser) {
        matchedUser = fallbackStore.users.find(u => u.email.toLowerCase() === emailLower);
      }

      if (matchedUser) {
        item.name = matchedUser.name;
        item.role = matchedUser.role;
        item.vendorId = matchedUser.vendorId;
        item.avatar = matchedUser.avatar;
      }
    }
  }

  // Sort newest locked first
  result.sort((a, b) => b.lockedAt - a.lockedAt);
  return result;
}

/**
 * Unlock a user in Redis (Invoked by role ADMIN)
 */
export async function unlockUserInRedis(
  identifier: string,
  unlockedByAdmin?: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = identifier.trim().toLowerCase();
  const redis = getRedisClient();

  if (redis) {
    try {
      const pipeline = redis.pipeline();
      pipeline.del(`${REDIS_LOCKOUT_PREFIX}${cleanId}`);
      pipeline.srem(REDIS_LOCKED_SET, cleanId);

      // In case it was stored with or without ip_ prefix
      if (cleanId.startsWith('ip_')) {
        const bareIp = cleanId.replace('ip_', '');
        pipeline.del(`${REDIS_LOCKOUT_PREFIX}${bareIp}`);
        pipeline.srem(REDIS_LOCKED_SET, bareIp);
      } else {
        pipeline.del(`${REDIS_LOCKOUT_PREFIX}email_${cleanId}`);
        pipeline.srem(REDIS_LOCKED_SET, `email_${cleanId}`);
      }

      await pipeline.exec();

      logRedis({
        event: 'CONNECTED',
        message: `Admin (${unlockedByAdmin || 'ADMIN'}) berhasil membuka kunci user/IP ${cleanId} dari Redis.`,
        details: {
          identifier: cleanId,
          unlockedByAdmin,
          timestamp: new Date().toISOString()
        }
      }).catch(() => {});
    } catch (err: any) {
      console.warn('[Redis Lockout] Warning deleting lockout key from Redis:', err?.message);
    }
  }

  // Delete from in-memory fallback as well
  inMemoryLockouts.delete(cleanId);
  inMemoryLockedSet.delete(cleanId);
  if (cleanId.startsWith('ip_')) {
    const bareIp = cleanId.replace('ip_', '');
    inMemoryLockouts.delete(bareIp);
    inMemoryLockedSet.delete(bareIp);
  } else {
    inMemoryLockouts.delete(`email_${cleanId}`);
    inMemoryLockedSet.delete(`email_${cleanId}`);
  }

  return {
    success: true,
    message: `User/IP ${cleanId} berhasil dibuka kuncinya dan status lockout telah direset.`
  };
}

/**
 * Unlock ALL locked users in Redis (Bulk operation for role ADMIN)
 */
export async function unlockAllUsersInRedis(
  unlockedByAdmin?: string
): Promise<{ success: boolean; unlockedCount: number; message: string }> {
  const lockedUsers = await getLockedUsersFromRedis();
  let count = 0;

  for (const u of lockedUsers) {
    await unlockUserInRedis(u.identifier, unlockedByAdmin);
    count++;
  }

  // Clear entire set
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(REDIS_LOCKED_SET);
    } catch (e) {}
  }
  inMemoryLockedSet.clear();
  inMemoryLockouts.clear();

  return {
    success: true,
    unlockedCount: count,
    message: `Semua akun yang terkunci (${count} akun) berhasil dibuka kuncinya.`
  };
}

/**
 * Manually lock a user in Redis (for testing or emergency administrative action)
 */
export async function lockUserManually(
  identifier: string,
  reason: string = 'Dikunci secara manual oleh Admin',
  lockedByAdmin?: string
): Promise<LockoutStatus> {
  const { key, type } = normalizeLockoutKey(
    identifier.includes('@') ? identifier : undefined,
    identifier.includes('@') ? undefined : identifier
  );
  const now = Date.now();
  const redis = getRedisClient();

  const record: LockoutRecord = {
    identifier: key,
    type,
    email: type === 'email' ? key : undefined,
    ip: type === 'ip' ? key.replace('ip_', '') : undefined,
    failedAttempts: MAX_FAILED_ATTEMPTS,
    isLocked: true,
    lockedAt: now,
    lockedUntil: now + LOCKOUT_DURATION_MS,
    lastAttemptAt: now,
    reason: `${reason} (Oleh: ${lockedByAdmin || 'ADMIN'})`
  };

  if (redis) {
    try {
      const redisKey = `${REDIS_LOCKOUT_PREFIX}${key}`;
      const pipeline = redis.pipeline();
      pipeline.set(redisKey, JSON.stringify(record), 'EX', LOCKOUT_DURATION_SECONDS);
      pipeline.sadd(REDIS_LOCKED_SET, key);
      await pipeline.exec();
    } catch (err: any) {
      console.warn('[Redis Lockout] Warning manually locking user in Redis:', err?.message);
    }
  }

  inMemoryLockouts.set(key, record);
  inMemoryLockedSet.add(key);

  return {
    isLocked: true,
    lockedUntil: record.lockedUntil,
    remainingSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    failedAttempts: MAX_FAILED_ATTEMPTS,
    attemptsRemaining: 0,
    identifier: key
  };
}
