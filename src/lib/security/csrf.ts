export const CSRF_COOKIE_NAME = "dc_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createCsrfToken() {
  return crypto.randomUUID();
}
