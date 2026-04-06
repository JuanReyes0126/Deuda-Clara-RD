import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  HOST_PANEL_ROUTE,
  HOST_PANEL_SESSION_COOKIE,
  HOST_PANEL_UNLOCK_ROUTE,
  isHostPanelEnabledFlag,
} from "@/lib/host/panel";
import {
  applySecurityHeaders,
  buildNonceCanaryPolicy,
} from "@/lib/security/headers";
import {
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_MAX_AGE_SECONDS,
  createCsrfToken,
} from "@/lib/security/csrf";

const HOST_ACCESS_INTERNAL_HEADER = "x-deuda-clara-host-access";
const HOST_NOT_FOUND_ROUTE = "/private-host-404";
const NONCE_CSP_CANARY_ROUTES = new Set([
  "/",
  "/configuracion",
  "/dashboard",
  "/deudas",
  "/host",
  "/host/unlock",
  "/login",
  "/notificaciones",
  "/onboarding",
  "/pagos",
  "/planes",
  "/private-host-404",
  "/recuperar-contrasena",
  "/registro",
  "/reportes",
  "/simulador",
  "/vista-demo",
]);
const NONCE_CSP_CANARY_PREFIXES = ["/restablecer-contrasena/"] as const;

type HostAccessResult =
  | { ok: true }
  | {
      ok: false;
      outcome:
        | "LOGIN"
        | "NOT_FOUND"
        | "SECONDARY_REQUIRED"
        | "MFA_SETUP_REQUIRED";
    };

async function checkHostAccess(request: NextRequest) {
  const accessUrl = new URL("/api/internal/host-access", request.url);
  accessUrl.searchParams.set("pathname", request.nextUrl.pathname);

  const response = await fetch(accessUrl, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      [HOST_ACCESS_INTERNAL_HEADER]: process.env.AUTH_SECRET ?? "",
    },
    cache: "no-store",
  });

  if (response.status !== 200) {
    return null;
  }

  return (await response.json()) as HostAccessResult;
}

function attachNoIndexHeader(response: NextResponse) {
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
}

function shouldApplyNonceCanary(pathname: string) {
  return (
    NONCE_CSP_CANARY_ROUTES.has(pathname) ||
    NONCE_CSP_CANARY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function shouldUseNonceCanaryForRequest(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost";
  const isLocalDevelopment =
    process.env.NODE_ENV !== "production" &&
    request.nextUrl.protocol === "http:" &&
    isLocalHost;

  return !isLocalDevelopment && shouldApplyNonceCanary(request.nextUrl.pathname);
}

function createNonce() {
  return btoa(crypto.randomUUID());
}

function buildNonceRequestHeaders(request: NextRequest, nonce: string) {
  const requestHeaders = new Headers(request.headers);
  const upgradeInsecureRequests = request.nextUrl.protocol === "https:";

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(
    "content-security-policy",
    buildNonceCanaryPolicy(nonce, { upgradeInsecureRequests }),
  );
  requestHeaders.delete("content-security-policy-report-only");

  return requestHeaders;
}

function buildNextResponse(requestHeaders?: Headers) {
  return requestHeaders
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : NextResponse.next();
}

function buildRewriteResponse(url: URL, requestHeaders?: Headers) {
  return requestHeaders
    ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    : NextResponse.rewrite(url);
}

function secureResponse(
  response: NextResponse,
  request: NextRequest,
  nonce?: string,
) {
  const secured = applySecurityHeaders(response, request);

  if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
    secured.cookies.set(CSRF_COOKIE_NAME, createCsrfToken(), {
      httpOnly: false,
      maxAge: CSRF_TOKEN_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
  }

  if (nonce && shouldUseNonceCanaryForRequest(request)) {
    secured.headers.set(
      "content-security-policy",
      buildNonceCanaryPolicy(nonce, {
        upgradeInsecureRequests: request.nextUrl.protocol === "https:",
      }),
    );
    secured.headers.delete("content-security-policy-report-only");
  }

  return secured;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isInternalRoute =
    pathname.startsWith("/host") || pathname.startsWith("/admin");
  const nonce = shouldUseNonceCanaryForRequest(request) ? createNonce() : undefined;
  const requestHeaders = nonce ? buildNonceRequestHeaders(request, nonce) : undefined;

  if (!isInternalRoute) {
    return secureResponse(buildNextResponse(requestHeaders), request, nonce);
  }

  if (!isHostPanelEnabledFlag(process.env.HOST_PANEL_ENABLED)) {
    return secureResponse(
      buildRewriteResponse(
        new URL(HOST_NOT_FOUND_ROUTE, request.url),
        requestHeaders,
      ),
      request,
      nonce,
    );
  }

  if (!request.cookies.get(HOST_PANEL_SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", request.url);
    return secureResponse(attachNoIndexHeader(NextResponse.redirect(loginUrl)), request);
  }

  if (pathname.startsWith("/admin")) {
    return secureResponse(
      attachNoIndexHeader(
        NextResponse.redirect(new URL(HOST_PANEL_ROUTE, request.url)),
      ),
      request,
    );
  }

  const accessResult = await checkHostAccess(request);

  if (accessResult?.ok) {
    return secureResponse(
      attachNoIndexHeader(buildNextResponse(requestHeaders)),
      request,
      nonce,
    );
  }

  if (accessResult?.outcome === "LOGIN") {
    return secureResponse(
      attachNoIndexHeader(
        NextResponse.redirect(new URL("/login", request.url)),
      ),
      request,
    );
  }

  if (
    accessResult?.outcome === "SECONDARY_REQUIRED" &&
    pathname !== HOST_PANEL_UNLOCK_ROUTE
  ) {
    return secureResponse(
      attachNoIndexHeader(
        NextResponse.redirect(new URL(HOST_PANEL_UNLOCK_ROUTE, request.url)),
      ),
      request,
    );
  }

  if (
    accessResult?.outcome === "SECONDARY_REQUIRED" &&
    pathname === HOST_PANEL_UNLOCK_ROUTE
  ) {
    return secureResponse(
      attachNoIndexHeader(buildNextResponse(requestHeaders)),
      request,
      nonce,
    );
  }

  if (accessResult?.outcome === "MFA_SETUP_REQUIRED") {
    return secureResponse(
      attachNoIndexHeader(
        NextResponse.redirect(
          new URL("/configuracion?security=admin-mfa-required", request.url),
        ),
      ),
      request,
    );
  }

  return secureResponse(
    attachNoIndexHeader(
      buildRewriteResponse(
        new URL(HOST_NOT_FOUND_ROUTE, request.url),
        requestHeaders,
      ),
    ),
    request,
    nonce,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
  ],
};
