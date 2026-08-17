import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_SAFE_METHODS,
} from "@/lib/security/csrf";

function readCsrfTokenFromCookie() {
  if (typeof document === "undefined") {
    return null;
  }

  const cookiePrefix = `${CSRF_COOKIE_NAME}=`;
  const csrfCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(cookiePrefix));

  if (!csrfCookie) {
    return null;
  }

  try {
    return decodeURIComponent(csrfCookie.slice(cookiePrefix.length));
  } catch {
    return null;
  }
}

export function fetchWithCsrf(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();

  if (CSRF_SAFE_METHODS.has(method)) {
    return fetch(input, init);
  }

  const headers = new Headers(init?.headers);
  const csrfToken = readCsrfTokenFromCookie();

  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
    method,
  });
}
