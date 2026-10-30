declare const process: { env?: Record<string, string | undefined> } | undefined;

/** The in-memory relay transports synthetic demo snapshots only; it is never a production data API. */
export function isDemoRelayEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  return (
    process.env?.NODE_ENV !== 'production' &&
    (process.env?.HEALTHCONNECT_DEMO_MODE === 'true' || process.env?.VITE_DEMO_MODE === 'true')
  );
}

export function denyIfDemoRelayDisabled(res: any): boolean {
  if (isDemoRelayEnabled()) return false;
  const payload = {
    success: false,
    error: 'The in-memory synchronization relay is disabled. Use a tenant-scoped clinical data service.',
  };
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(503).json(payload);
  } else {
    res.statusCode = 503;
    res.setHeader?.('Content-Type', 'application/json');
    res.end?.(JSON.stringify(payload));
  }
  return true;
}

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitBuckets: Map<string, RateLimitEntry> = new Map();

/**
 * Lightweight sliding-window rate limiter (in-memory, zero-dependency)
 * Protects clinical AI and hardware ingestion endpoints against DoS and credential stuffing.
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60000
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitBuckets.set(key, entry);
  }

  // Purge timestamps older than the sliding window
  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  entry.timestamps.push(now);

  // Periodic memory hygiene: clean up stale keys if map exceeds 2000 entries
  if (rateLimitBuckets.size > 2000) {
    for (const [k, v] of rateLimitBuckets.entries()) {
      v.timestamps = v.timestamps.filter((ts) => ts > windowStart);
      if (v.timestamps.length === 0) {
        rateLimitBuckets.delete(k);
      }
    }
  }

  return { allowed: true };
}
