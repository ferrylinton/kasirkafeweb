import { getRedisClient } from './redis';

export interface RedisSessionData {
  sessionId: string;
  token: string;
  userId: string;
  email: string;
  role: 'MANAGER' | 'CASHIER';
  name: string;
  loginMethod?: string;
  device?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  lastActive: number;
}

// 15 minutes idle timeout in seconds (matching client-side IDLE_TIMEOUT_MS = 15 * 60 * 1000)
export const SESSION_IDLE_TIMEOUT_SECONDS = 15 * 60; // 900 seconds

// In-memory fallback session store with TTL tracking in case Redis is momentarily disconnected
const inMemorySessions = new Map<string, { data: RedisSessionData; expiresAt: number }>();
// Map sessionId -> token for rapid lookups
const inMemorySessionIdToToken = new Map<string, string>();
// Map user email -> active token for single active browser enforcement
const inMemoryUserToToken = new Map<string, string>();
// Map user email -> active sessionId
const inMemoryUserToSessionId = new Map<string, string>();

// Clean up expired in-memory sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, item] of inMemorySessions.entries()) {
    if (item.expiresAt <= now) {
      inMemorySessions.delete(token);
      if (item.data?.sessionId) {
        inMemorySessionIdToToken.delete(item.data.sessionId);
      }
      if (item.data?.email) {
        const uEmail = item.data.email.toLowerCase().trim();
        if (inMemoryUserToToken.get(uEmail) === token) {
          inMemoryUserToToken.delete(uEmail);
          inMemoryUserToSessionId.delete(uEmail);
        }
      }
    }
  }
}, 30 * 1000);

/**
 * Store active session metadata in Redis with 15-minute TTL.
 * Automatically invalidates previous active sessions for the same user.
 */
export async function saveSessionToRedis(
  token: string,
  sessionData: RedisSessionData,
  ttlSeconds: number = SESSION_IDLE_TIMEOUT_SECONDS
): Promise<void> {
  const now = Date.now();
  sessionData.lastActive = now;
  const userEmail = sessionData.email ? sessionData.email.toLowerCase().trim() : '';

  // 1. In-memory fallback & user session tracking
  if (userEmail) {
    const prevToken = inMemoryUserToToken.get(userEmail);
    if (prevToken && prevToken !== token) {
      inMemorySessions.delete(prevToken);
    }
    inMemoryUserToToken.set(userEmail, token);
    if (sessionData.sessionId) {
      inMemoryUserToSessionId.set(userEmail, sessionData.sessionId);
    }
  }

  inMemorySessions.set(token, {
    data: sessionData,
    expiresAt: now + ttlSeconds * 1000
  });
  if (sessionData.sessionId) {
    inMemorySessionIdToToken.set(sessionData.sessionId, token);
  }

  // 2. Persist in Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      const pipeline = redis.pipeline();
      const tokenKey = `session:token:${token}`;
      pipeline.set(tokenKey, JSON.stringify(sessionData), 'EX', ttlSeconds);
      if (sessionData.sessionId) {
        pipeline.set(`session:id:${sessionData.sessionId}`, token, 'EX', ttlSeconds);
      }
      if (userEmail) {
        const userKey = `session:user:${userEmail}`;
        const prevToken = await redis.get(userKey);
        if (prevToken && prevToken !== token) {
          pipeline.del(`session:token:${prevToken}`);
        }
        pipeline.set(userKey, token, 'EX', ttlSeconds);
        if (sessionData.sessionId) {
          pipeline.set(`session:usersess:${userEmail}`, sessionData.sessionId, 'EX', ttlSeconds);
        }
      }
      await pipeline.exec();
    } catch (err: any) {
      console.warn('[Redis Session] Warning saving session to Redis:', err?.message);
    }
  }
}

/**
 * Get and optionally touch (refresh TTL) active session from Redis.
 * If session does not exist (or expired after 15m idle), returns null.
 */
export async function getSessionFromRedis(
  token: string,
  touch: boolean = true
): Promise<RedisSessionData | null> {
  const now = Date.now();
  const redis = getRedisClient();

  if (redis) {
    try {
      const tokenKey = `session:token:${token}`;
      const raw = await redis.get(tokenKey);
      if (raw) {
        const session: RedisSessionData = JSON.parse(raw);
        if (touch) {
          session.lastActive = now;
          const pipeline = redis.pipeline();
          pipeline.set(tokenKey, JSON.stringify(session), 'EX', SESSION_IDLE_TIMEOUT_SECONDS);
          if (session.sessionId) {
            pipeline.expire(`session:id:${session.sessionId}`, SESSION_IDLE_TIMEOUT_SECONDS);
          }
          await pipeline.exec();

          // Sync in-memory fallback as well
          inMemorySessions.set(token, {
            data: session,
            expiresAt: now + SESSION_IDLE_TIMEOUT_SECONDS * 1000
          });
        }
        return session;
      }
    } catch (err: any) {
      console.warn('[Redis Session] Warning retrieving session from Redis, checking fallback:', err?.message);
    }
  }

  // Fallback check in memory
  const entry = inMemorySessions.get(token);
  if (entry) {
    if (entry.expiresAt > now) {
      if (touch) {
        entry.data.lastActive = now;
        entry.expiresAt = now + SESSION_IDLE_TIMEOUT_SECONDS * 1000;
      }
      return entry.data;
    } else {
      inMemorySessions.delete(token);
      if (entry.data?.sessionId) {
        inMemorySessionIdToToken.delete(entry.data.sessionId);
      }
    }
  }

  return null;
}

/**
 * Explicitly touch/refresh session TTL in Redis (e.g. on user activity)
 */
export async function refreshSessionActivity(token: string): Promise<boolean> {
  const session = await getSessionFromRedis(token, true);
  return session !== null;
}

/**
 * Remove session from Redis on user logout or session revocation
 */
export async function removeSessionFromRedis(
  tokenOrSessionId: string
): Promise<void> {
  const redis = getRedisClient();
  let token = tokenOrSessionId;
  let sessionId = tokenOrSessionId;

  // Determine if passed parameter is token or sessionId
  if (inMemorySessionIdToToken.has(tokenOrSessionId)) {
    token = inMemorySessionIdToToken.get(tokenOrSessionId)!;
  } else if (inMemorySessions.has(tokenOrSessionId)) {
    const data = inMemorySessions.get(tokenOrSessionId)?.data;
    if (data?.sessionId) sessionId = data.sessionId;
  }

  // Remove from memory
  inMemorySessions.delete(token);
  inMemorySessionIdToToken.delete(sessionId);
  for (const [uEmail, tok] of inMemoryUserToToken.entries()) {
    if (tok === token) {
      inMemoryUserToToken.delete(uEmail);
      inMemoryUserToSessionId.delete(uEmail);
      break;
    }
  }

  // Remove from Redis
  if (redis) {
    try {
      // If it might be a sessionId, lookup the token in Redis
      if (!token.startsWith('ey') && sessionId) {
        const mappedToken = await redis.get(`session:id:${sessionId}`);
        if (mappedToken) {
          token = mappedToken;
        }
      }

      const pipeline = redis.pipeline();
      pipeline.del(`session:token:${token}`);
      if (sessionId) {
        pipeline.del(`session:id:${sessionId}`);
      }
      await pipeline.exec();
    } catch (err: any) {
      console.warn('[Redis Session] Warning deleting session from Redis:', err?.message);
    }
  }
}

/**
 * Get active token for a user email
 */
export async function getActiveTokenForUser(email: string): Promise<string | null> {
  const userEmail = email.toLowerCase().trim();
  const redis = getRedisClient();
  if (redis) {
    try {
      const token = await redis.get(`session:user:${userEmail}`);
      if (token) return token;
    } catch (e) {}
  }
  return inMemoryUserToToken.get(userEmail) || null;
}

/**
 * Get active sessionId for a user email
 */
export async function getActiveSessionIdForUser(email: string): Promise<string | null> {
  const userEmail = email.toLowerCase().trim();
  const redis = getRedisClient();
  if (redis) {
    try {
      const sessId = await redis.get(`session:usersess:${userEmail}`);
      if (sessId) return sessId;
    } catch (e) {}
  }
  return inMemoryUserToSessionId.get(userEmail) || null;
}

/**
 * Invalidate and remove any active session for this user in session store
 */
export async function invalidateUserSessionInStore(email: string): Promise<void> {
  const userEmail = email.toLowerCase().trim();
  const memToken = inMemoryUserToToken.get(userEmail);
  const memSessId = inMemoryUserToSessionId.get(userEmail);
  if (memToken) {
    inMemorySessions.delete(memToken);
  }
  if (memSessId) {
    inMemorySessionIdToToken.delete(memSessId);
  }
  inMemoryUserToToken.delete(userEmail);
  inMemoryUserToSessionId.delete(userEmail);

  const redis = getRedisClient();
  if (redis) {
    try {
      const prevToken = await redis.get(`session:user:${userEmail}`);
      const prevSessId = await redis.get(`session:usersess:${userEmail}`);
      const pipeline = redis.pipeline();
      if (prevToken) pipeline.del(`session:token:${prevToken}`);
      if (prevSessId) pipeline.del(`session:id:${prevSessId}`);
      pipeline.del(`session:user:${userEmail}`);
      pipeline.del(`session:usersess:${userEmail}`);
      await pipeline.exec();
    } catch (e) {}
  }
}

/**
 * Check if a session ID currently has an active, unexpired session in Redis or memory
 */
export async function isSessionActiveInRedis(sessionId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const token = await redis.get(`session:id:${sessionId}`);
      if (token) {
        const sessionExists = await redis.exists(`session:token:${token}`);
        if (sessionExists) return true;
      }
    } catch (e) {}
  }

  const inMemToken = inMemorySessionIdToToken.get(sessionId);
  if (inMemToken) {
    const entry = inMemorySessions.get(inMemToken);
    if (entry && entry.expiresAt > Date.now()) {
      return true;
    }
  }

  return false;
}
