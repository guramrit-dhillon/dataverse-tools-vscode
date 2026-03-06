import { HttpError } from "./http-error";
import { Logger } from "./logger";

export interface RetryOptions {
  attempts: number;
  delayMs: number;
  /** Multiply delay by this factor on each retry. Default: 2. */
  backoffFactor?: number;
  /** Only retry if this predicate returns true. Default: retry all errors. */
  retryIf?: (err: unknown) => boolean;
}

/**
 * Retry an async operation with exponential back-off.
 *
 * @example
 * const result = await retry(
 *   () => fetch(url, { headers }).then(r => r.json()),
 *   { attempts: 3, delayMs: 500 }
 * );
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { attempts, delayMs, backoffFactor = 2, retryIf } = options;
  let lastError: unknown;
  let delay = delayMs;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const shouldRetry = retryIf ? retryIf(err) : true;
      if (!shouldRetry || attempt === attempts) {
        break;
      }

      Logger.debug(`Retry attempt ${attempt}/${attempts} after ${delay}ms`, {
        error: err instanceof Error ? err.message : String(err),
      });

      await sleep(delay);
      delay *= backoffFactor;
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns true for transient HTTP errors that are safe to retry. */
export function isTransientHttpError(err: unknown): boolean {
  // Timeout / network errors from fetch are transient
  if (err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError") || (err instanceof Error && err.name === "TimeoutError")) {
    return true;
  }
  if (!(err instanceof HttpError)) {
    return false;
  }
  // 429 Too Many Requests, 502/503/504 gateway errors
  return err.status === 429 || err.status === 502 || err.status === 503 || err.status === 504;
}
