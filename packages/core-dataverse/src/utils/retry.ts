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
 *   () => axios.get(url, { headers }),
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
  if (!isAxiosError(err)) {
    return false;
  }
  const status = err.response?.status;
  // 429 Too Many Requests, 502/503/504 gateway errors
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isAxiosError(err: unknown): err is {
  response?: { status: number };
  code?: string;
} {
  return typeof err === "object" && err !== null && "isAxiosError" in err;
}
