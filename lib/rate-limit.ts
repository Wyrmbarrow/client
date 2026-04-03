// In-memory rate limiter for LLM calls (global, not per-user)
// Disabled by default; enable via LLM_RATE_LIMIT_ENABLED=true
// Enforces a single rate limit across all concurrent sessions to respect provider limits

const ENABLED = process.env.LLM_RATE_LIMIT_ENABLED === "true";
const MAX_REQUESTS = Number(process.env.LLM_RATE_LIMIT_MAX_REQUESTS ?? "40");
const WINDOW_MS = Number(process.env.LLM_RATE_LIMIT_WINDOW_MS ?? "60000"); // 1 min default

const globalTimestamps: number[] = [];

export function checkLLMRateLimit(): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  if (!ENABLED) {
    return { allowed: true, remaining: MAX_REQUESTS, resetAt: Date.now() + WINDOW_MS };
  }

  const now = Date.now();

  // Remove old timestamps outside the window
  while (globalTimestamps.length > 0 && now - globalTimestamps[0] >= WINDOW_MS) {
    globalTimestamps.shift();
  }

  const allowed = globalTimestamps.length < MAX_REQUESTS;
  const remaining = Math.max(0, MAX_REQUESTS - globalTimestamps.length);

  if (allowed) {
    globalTimestamps.push(now);
  }

  const oldestTimestamp = globalTimestamps[0] ?? now;
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
