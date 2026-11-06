import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getRedisClient } from './redis';
import { logRedis } from './dailyRollingLogger';

/**
 * Fast In-Memory Store / Cache for Token Denylist (Blocklist)
 * Maps jti -> expiresAtTimestamp (ms)
 * Provides instantaneous O(1) in-memory lookups
 */
const inMemoryDenylist = new Map<string, number>();

// Periodic garbage collection for expired entries in the in-memory store
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of inMemoryDenylist.entries()) {
    if (expiresAt <= now) {
      inMemoryDenylist.delete(jti);
    }
  }
}, 30 * 1000);

/**
 * Add a token's unique identifier (jti) to the Denylist (Blocklist)
 * with a TTL matching the token's remaining expiration.
 *
 * @param jti The unique JWT Identifier claim
 * @param ttlSeconds Time-to-live in seconds matching token expiration
 * @param reason Optional human-readable revocation reason
 */
export async function addTokenToDenylist(
  jti: string,
  ttlSeconds: number,
  reason: string = 'USER_LOGOUT'
): Promise<void> {
  if (!jti || typeof jti !== 'string') return;

  const validTtl = Math.max(1, Math.ceil(ttlSeconds));
  const now = Date.now();
  const expiresAtMs = now + validTtl * 1000;

  // 1. Add to fast in-memory store immediately
  inMemoryDenylist.set(jti, expiresAtMs);

  // 2. Persist to Redis if available with exact TTL
  const redis = getRedisClient();
  if (redis) {
    try {
      const redisKey = `jwt:denylist:${jti}`;
      const payload = JSON.stringify({
        jti,
        reason,
        revokedAt: new Date(now).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString()
      });

      await redis.set(redisKey, payload, 'EX', validTtl);

      logRedis({
        event: 'TOKEN_DENYLIST_ADD',
        message: `Token jti=${jti} ditambahkan ke Redis Denylist dengan TTL ${validTtl} detik (Alasan: ${reason})`,
        details: { jti, ttlSeconds: validTtl, reason }
      }).catch(() => {});
    } catch (err: any) {
      console.warn('[TokenDenylist] Warning storing jti in Redis, operating in-memory:', err?.message);
    }
  }
}

/**
 * Check if a token's jti is in the Denylist (Blocklist).
 * Checks the fast in-memory store first (microsecond response),
 * then checks Redis.
 *
 * @param jti The unique JWT Identifier claim
 * @returns true if the token is denylisted, false otherwise
 */
export async function isTokenDenylisted(jti: string): Promise<boolean> {
  if (!jti || typeof jti !== 'string') return false;

  const now = Date.now();

  // 1. Check fast in-memory store
  const inMemExpiresAt = inMemoryDenylist.get(jti);
  if (inMemExpiresAt !== undefined) {
    if (inMemExpiresAt > now) {
      return true;
    } else {
      inMemoryDenylist.delete(jti);
    }
  }

  // 2. Check Redis store
  const redis = getRedisClient();
  if (redis) {
    try {
      const redisKey = `jwt:denylist:${jti}`;
      const exists = await redis.exists(redisKey);
      if (exists) {
        // Cache in memory with remaining Redis TTL for future rapid lookups
        const ttl = await redis.ttl(redisKey);
        if (ttl > 0) {
          inMemoryDenylist.set(jti, now + ttl * 1000);
        }
        return true;
      }
    } catch (err: any) {
      console.warn('[TokenDenylist] Warning checking Redis denylist:', err?.message);
    }
  }

  return false;
}

/**
 * Helper to revoke a JWT token by token string.
 * Decodes claims to extract jti and exp, calculates the remaining TTL,
 * and adds the jti to the denylist.
 *
 * @param tokenString Raw JWT token string
 * @param reason Reason for revocation
 */
export async function revokeJwtToken(
  tokenString: string,
  reason: string = 'USER_LOGOUT'
): Promise<{ success: boolean; jti?: string; ttlSeconds?: number }> {
  if (!tokenString || typeof tokenString !== 'string') {
    return { success: false };
  }

  try {
    const decoded = jwt.decode(tokenString) as any;
    if (!decoded) {
      return { success: false };
    }

    // Extract or derive JTI
    let jti = decoded.jti;
    if (!jti) {
      // Fallback for legacy tokens without explicit jti claim: use hash of the token
      jti = `legacy_${crypto.createHash('sha256').update(tokenString).digest('hex').substring(0, 32)}`;
    }

    // Calculate remaining TTL matching token's expiration
    let ttlSeconds = 15 * 60; // default 15 minutes
    if (typeof decoded.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      ttlSeconds = decoded.exp - nowSec;
    }

    if (ttlSeconds <= 0) {
      // Already expired token, keep in denylist for a short safety window
      ttlSeconds = 60;
    }

    await addTokenToDenylist(jti, ttlSeconds, reason);

    return {
      success: true,
      jti,
      ttlSeconds
    };
  } catch (err: any) {
    console.warn('[TokenDenylist] Error revoking JWT token:', err?.message);
    return { success: false };
  }
}

/**
 * Get current statistics of the Token Denylist
 */
export function getDenylistStats() {
  const redis = getRedisClient();
  return {
    inMemoryDenylistedCount: inMemoryDenylist.size,
    isRedisConnected: !!redis
  };
}
