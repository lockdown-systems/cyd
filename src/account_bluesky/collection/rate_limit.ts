/**
 * Recognizing AT Protocol rate limits.
 *
 * Bluesky's rate limits are normal operation for anyone saving a whole
 * account, not a failure. What matters is that Cyd can tell a rate limit apart
 * from a real error and can say when it will try again, so a waiting job reads
 * as waiting rather than as hung.
 */

/** Longest Cyd waits on a server's word alone before trying again anyway. */
const MAXIMUM_WAIT_MS = 15 * 60 * 1000;

/** Where backoff starts when the server names no reset time. */
const FALLBACK_WAIT_MS = 30 * 1000;

const headerValue = (headers: unknown, name: string): string | null => {
  if (typeof headers !== "object" || headers === null) {
    return null;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === "string" ? value : null;
};

const isRateLimit = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { status?: unknown; error?: unknown };
  if (candidate.status === 429) {
    return true;
  }
  return candidate.error === "RateLimitExceeded";
};

/**
 * When to resume after a rate limit, or null when the error was not one.
 *
 * `ratelimit-reset` is an absolute time and `retry-after` a delay; both are
 * honored as the server sent them, up to a ceiling, because a server that asks
 * for an implausibly long wait must not strand the job forever. Without either
 * header, backoff doubles with each rate limit this run has already hit.
 */
export const blueskyRateLimitResumeAt = (
  error: unknown,
  occurrences: number,
  now: Date,
): Date | null => {
  if (!isRateLimit(error)) {
    return null;
  }

  const headers = (error as { headers?: unknown }).headers;

  const reset = Number(headerValue(headers, "ratelimit-reset"));
  if (Number.isFinite(reset) && reset > 0) {
    const waitMS = reset * 1000 - now.getTime();
    return new Date(now.getTime() + clampWait(waitMS));
  }

  const retryAfter = Number(headerValue(headers, "retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return new Date(now.getTime() + clampWait(retryAfter * 1000));
  }

  return new Date(
    now.getTime() +
      clampWait(FALLBACK_WAIT_MS * 2 ** Math.max(occurrences - 1, 0)),
  );
};

const clampWait = (waitMS: number): number =>
  Math.min(Math.max(waitMS, 1000), MAXIMUM_WAIT_MS);
