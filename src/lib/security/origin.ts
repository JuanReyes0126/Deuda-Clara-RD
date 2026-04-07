import type { NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_SAFE_METHODS,
} from "@/lib/security/csrf";
import { logSecurityEvent } from "@/server/observability/logger";
import { ServiceError } from "@/server/services/service-error";

function normalizeOrigin(value: string) {
  return new URL(value).origin;
}

function buildAllowedOrigins(request: NextRequest) {
  const origins = new Set<string>();
  const env = getServerEnv();
  const host = request.headers.get("host");
  const protocol = request.nextUrl.protocol;
  const appUrl = env.APP_URL;
  const isProduction = env.NODE_ENV === "production";

  if (appUrl) {
    origins.add(new URL(appUrl).origin);
  }

  if (!isProduction && host) {
    origins.add(`${protocol}//${host}`.replace(/\/$/, ""));
    origins.add(`https://${host}`);
  }

  return origins;
}

export function assertSameOrigin(
  request: NextRequest,
  options?: { fallbackCsrfToken?: string | null | undefined },
) {
  return assertSameOriginWithOptions(request, options);
}

export function assertSameOriginWithOptions(
  request: NextRequest,
  options?: { fallbackCsrfToken?: string | null | undefined },
) {
  if (CSRF_SAFE_METHODS.has(request.method)) {
    return;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowedOrigins = buildAllowedOrigins(request);
  const candidate = origin ?? referer;

  if (!candidate) {
    logSecurityEvent("origin_missing", {
      route: request.nextUrl.pathname,
      method: request.method,
      host: request.headers.get("host") ?? undefined,
    });
    throw new ServiceError("ORIGIN_MISSING", 403, "La solicitud fue bloqueada por seguridad.");
  }

  const normalizedCandidate = normalizeOrigin(candidate);

  if (!allowedOrigins.has(normalizedCandidate)) {
    logSecurityEvent("origin_blocked", {
      route: request.nextUrl.pathname,
      method: request.method,
      origin: origin ?? undefined,
      referer: referer ?? undefined,
      host: request.headers.get("host") ?? undefined,
    });
    throw new ServiceError("ORIGIN_NOT_ALLOWED", 403, "La solicitud fue bloqueada por seguridad.");
  }

  const csrfCookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const csrfRequestToken =
    request.headers.get(CSRF_HEADER_NAME) ?? options?.fallbackCsrfToken ?? null;

  if (
    !csrfCookieToken ||
    !csrfRequestToken ||
    csrfCookieToken !== csrfRequestToken
  ) {
    logSecurityEvent("csrf_token_invalid", {
      route: request.nextUrl.pathname,
      method: request.method,
      host: request.headers.get("host") ?? undefined,
      hasCookieToken: Boolean(csrfCookieToken),
      hasHeaderToken: Boolean(request.headers.get(CSRF_HEADER_NAME)),
      hasFallbackToken: Boolean(options?.fallbackCsrfToken),
    });
    throw new ServiceError(
      "CSRF_TOKEN_INVALID",
      403,
      "La solicitud fue bloqueada por seguridad.",
    );
  }
}
