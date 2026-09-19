import Redis from 'ioredis';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

let redisClient: Redis | null = null;
let isRedisReady = false;

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      tls: {
        rejectUnauthorized: false
      }
    });

    redisClient.on('connect', () => {
      isRedisReady = true;
      console.log('[Redis] Connected successfully to Redis!');
    });

    redisClient.on('error', () => {
      isRedisReady = false;
      // Keep log clean, fallback will handle requests
    });
  } catch (e: any) {
    console.warn('[Redis] Initialization warning, using fallback token bucket');
  }
} else {
  console.log('[Redis] No REDIS_URL configured. Operating with in-memory token bucket & session store.');
}

// In-memory token bucket fallback
interface Bucket {
  tokens: number;
  lastRefill: number;
}
const localBuckets = new Map<string, Bucket>();

export interface TokenBucketConfig {
  capacity: number;      // Maximum tokens in bucket (e.g. 60)
  refillRate: number;    // Tokens added per second (e.g. 2 tokens/sec)
}

const DEFAULT_CONFIG: TokenBucketConfig = {
  capacity: 60,
  refillRate: 2
};

/**
 * Token Bucket algorithm implemented over Redis with fallback
 */
export async function consumeToken(
  key: string,
  config: TokenBucketConfig = DEFAULT_CONFIG
): Promise<{ allowed: boolean; remainingTokens: number; retryAfterSec: number }> {
  const now = Date.now();
  const redisKey = `ratelimit:bucket:${key}`;

  if (isRedisReady && redisClient) {
    try {
      // Fetch current bucket state from Redis
      const data = await redisClient.hmget(redisKey, 'tokens', 'lastRefill');
      let tokens = data[0] ? parseFloat(data[0]) : config.capacity;
      let lastRefill = data[1] ? parseInt(data[1], 10) : now;

      // Calculate refill
      const elapsedSeconds = (now - lastRefill) / 1000;
      tokens = Math.min(config.capacity, tokens + elapsedSeconds * config.refillRate);
      lastRefill = now;

      if (tokens >= 1) {
        tokens -= 1;
        await redisClient
          .multi()
          .hmset(redisKey, {
            tokens: tokens.toFixed(2),
            lastRefill: lastRefill.toString()
          })
          .expire(redisKey, 3600)
          .exec();

        return {
          allowed: true,
          remainingTokens: Math.floor(tokens),
          retryAfterSec: 0
        };
      } else {
        const missing = 1 - tokens;
        const retryAfterSec = Math.ceil(missing / config.refillRate);
        return {
          allowed: false,
          remainingTokens: 0,
          retryAfterSec
        };
      }
    } catch (err) {
      // Fallback to local memory if Redis call fails
    }
  }

  // Local in-memory token bucket fallback
  let bucket = localBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
    localBuckets.set(key, bucket);
  }

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.capacity, bucket.tokens + elapsedSeconds * config.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remainingTokens: Math.floor(bucket.tokens),
      retryAfterSec: 0
    };
  } else {
    const missing = 1 - bucket.tokens;
    const retryAfterSec = Math.ceil(missing / config.refillRate);
    return {
      allowed: false,
      remainingTokens: 0,
      retryAfterSec
    };
  }
}

/**
 * Express Middleware for Token Bucket Rate Limiting
 */
export function tokenBucketRateLimiter(config: TokenBucketConfig = DEFAULT_CONFIG) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Identifier can be client IP or authenticated user ID
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown-client';
    const result = await consumeToken(ip, config);

    res.setHeader('X-RateLimit-Limit', config.capacity.toString());
    res.setHeader('X-RateLimit-Remaining', result.remainingTokens.toString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSec.toString());
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Batas laju permintaan terlampaui (Token Bucket). Silakan coba lagi dalam ${result.retryAfterSec} detik.`,
        retryAfter: result.retryAfterSec
      });
    }

    next();
  };
}

export function getRedisClient(): Redis | null {
  return isRedisReady ? redisClient : null;
}
