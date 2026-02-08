interface RateLimitRecord {
  readonly timestamps: readonly number[];
}

interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs?: number;
}

interface RateLimitConfig {
  readonly limit: number;
  readonly windowMs: number;
}

const store = new Map<string, RateLimitRecord>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

function cleanup(now: number, windowMs: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, record] of store) {
    const valid = record.timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, { timestamps: valid });
    }
  }
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  cleanup(now, config.windowMs);

  const cutoff = now - config.windowMs;
  const existing = store.get(key);
  const valid = existing
    ? existing.timestamps.filter((t) => t > cutoff)
    : [];

  if (valid.length >= config.limit) {
    const oldest = valid[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  store.set(key, { timestamps: [...valid, now] });
  return { allowed: true };
}

export function getClientKey(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "anonymous"
  );
}
