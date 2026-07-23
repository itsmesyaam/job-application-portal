interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const memoryStore = new Map<string, RateLimitBucket>();

/**
 * Checks rate limits for a given IP/identifier.
 * Connects to Upstash Redis REST API if credentials are provided,
 * otherwise falls back to a precise in-memory Token Bucket rate limiter.
 *
 * @param identifier Unique IP or token key.
 * @param limit Maximum capacity of the bucket.
 * @param durationSeconds Time window in seconds for the rate limit.
 * @returns Rate limit status details.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  durationSeconds: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const key = `ratelimit:${identifier}`;
      const now = Math.floor(Date.now() / 1000);
      const cleanUrl = redisUrl.replace(/\/$/, '');

      // Execute atomic pipeline: INCR and TTL checks using HTTP REST
      const response = await fetch(`${cleanUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['TTL', key],
        ]),
      });

      if (response.ok) {
        const data = await response.json();
        const currentCount = data[0]?.result || 1;
        let ttl = data[1]?.result || durationSeconds;

        if (ttl < 0) {
          ttl = durationSeconds;
        }

        // Set expiration on first hit
        if (currentCount === 1) {
          await fetch(`${cleanUrl}/EXPIRE`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${redisToken}` },
            body: JSON.stringify([key, durationSeconds]),
          });
        }

        const remaining = Math.max(0, limit - currentCount);
        const success = currentCount <= limit;
        return {
          success,
          limit,
          remaining,
          reset: now + ttl,
        };
      }
    } catch (e) {
      console.warn('[Rate Limit] Upstash connection failed. Falling back to local memory store.', e);
    }
  }

  // Fallback: Local Memory Token Bucket Limiter
  const now = Date.now();
  const refillRate = limit / (durationSeconds * 1000); // tokens/ms

  let bucket = memoryStore.get(identifier);
  if (!bucket) {
    bucket = { tokens: limit, lastRefill: now };
  } else {
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(limit, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    memoryStore.set(identifier, bucket);
    return {
      success: true,
      limit,
      remaining: Math.floor(bucket.tokens),
      reset: Math.ceil((now + (limit - bucket.tokens) / refillRate) / 1000),
    };
  } else {
    memoryStore.set(identifier, bucket);
    return {
      success: false,
      remaining: 0,
      limit,
      reset: Math.ceil((now + (1 - bucket.tokens) / refillRate) / 1000),
    };
  }
}
