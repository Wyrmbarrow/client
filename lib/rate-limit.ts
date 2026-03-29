// In-memory rate limiter for LLM calls
// Disabled by default; enable via LLM_RATE_LIMIT_ENABLED=true

const ENABLED = process.env.LLM_RATE_LIMIT_ENABLED === "true";
const MAX_REQUESTS = Number(process.env.LLM_RATE_LIMIT_MAX_REQUESTS ?? "40");
const WINDOW_MS = Number(process.env.LLM_RATE_LIMIT_WINDOW_MS ?? "60000"); // 1 min default

interface RateLimitEntry {
  timestamps: number[];
}

const userLimits = new Map<string, RateLimitEntry>();

export function checkLLMRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  if (!ENABLED) {
    return { allowed: true, remaining: MAX_REQUESTS, resetAt: Date.now() + WINDOW_MS };
  }

  const now = Date.now();
  let entry = userLimits.get(userId);

  if (!entry) {
    entry = { timestamps: [] };
    userLimits.set(userId, entry);
  }

  // Remove old timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < WINDOW_MS);

  const allowed = entry.timestamps.length < MAX_REQUESTS;
  const remaining = Math.max(0, MAX_REQUESTS - entry.timestamps.length);

  if (allowed) {
    entry.timestamps.push(now);
  }

  const oldestTimestamp = entry.timestamps[0] ?? now;
  const resetAt = oldestTimestamp + WINDOW_MS;

  return { allowed, remaining, resetAt };
}

export class RateLimitError extends Error {
  constructor(
    public remaining: number,
    public resetAt: number,
  ) {
    super(`LLM rate limit exceeded. Reset at ${new Date(resetAt).toISOString()}`);
    this.name = "RateLimitError";
  }
}
