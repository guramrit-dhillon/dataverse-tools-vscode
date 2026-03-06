/**
 * Lightweight error class for non-ok HTTP responses from fetch.
 * Replaces AxiosError shape — used by retry logic and DataverseError parsing.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}
