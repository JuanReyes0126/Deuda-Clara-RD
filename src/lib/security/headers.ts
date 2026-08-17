import type { NextRequest, NextResponse } from "next/server";

type ContentSecurityPolicyOptions = {
  upgradeInsecureRequests?: boolean;
  allowDevelopmentRuntime?: boolean;
};

function withOptionalUpgradeDirective(
  policy: string,
  { upgradeInsecureRequests = false }: ContentSecurityPolicyOptions = {},
) {
  if (!upgradeInsecureRequests) {
    return policy.replace(/\n/g, "");
  }

  return `${policy}
upgrade-insecure-requests;`.replace(/\n/g, "");
}

function buildContentSecurityPolicy(options?: ContentSecurityPolicyOptions) {
  const developmentScriptPolicy = options?.allowDevelopmentRuntime
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";
  const developmentConnectPolicy = options?.allowDevelopmentRuntime
    ? "'self' ws: wss: http://127.0.0.1:3000 http://localhost:3000"
    : "'self'";

  return withOptionalUpgradeDirective(
    `default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data: blob:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src ${developmentScriptPolicy};
connect-src ${developmentConnectPolicy};`,
    options,
  );
}

export function buildNonceReportOnlyPolicy(
  nonce: string,
  options?: ContentSecurityPolicyOptions,
) {
  return withOptionalUpgradeDirective(
    `default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data: blob:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self' 'nonce-${nonce}';
connect-src 'self';`,
    options,
  );
}

export function buildNonceCanaryPolicy(
  nonce: string,
  options?: ContentSecurityPolicyOptions,
) {
  return withOptionalUpgradeDirective(
    `default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data: blob:;
font-src 'self' data:;
style-src 'self' 'unsafe-inline';
script-src 'self' 'nonce-${nonce}';
connect-src 'self';`,
    options,
  );
}

function shouldUpgradeInsecureRequests(request: NextRequest) {
  return request.nextUrl.protocol === "https:";
}

function shouldAllowDevelopmentRuntime(request: NextRequest) {
  const isLocalHost =
    request.nextUrl.hostname === "127.0.0.1" ||
    request.nextUrl.hostname === "localhost";

  return process.env.NODE_ENV !== "production" && isLocalHost;
}

function shouldDisableCaching(pathname: string) {
  return (
    pathname.startsWith("/configuracion") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/deudas") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/notificaciones") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/pagos") ||
    pathname.startsWith("/planes") ||
    pathname.startsWith("/recuperar-contrasena") ||
    pathname.startsWith("/registro") ||
    pathname.startsWith("/reportes") ||
    pathname.startsWith("/restablecer-contrasena") ||
    pathname.startsWith("/simulador") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/internal") ||
    pathname.startsWith("/api/billing") ||
    pathname.startsWith("/api/jobs") ||
    pathname.startsWith("/host") ||
    pathname.startsWith("/admin")
  );
}

export function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "strict-transport-security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  response.headers.set("x-dns-prefetch-control", "off");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("x-permitted-cross-domain-policies", "none");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()",
  );
  response.headers.set("cross-origin-opener-policy", "same-origin");
  response.headers.set(
    "content-security-policy",
    buildContentSecurityPolicy({
      upgradeInsecureRequests: shouldUpgradeInsecureRequests(request),
      allowDevelopmentRuntime: shouldAllowDevelopmentRuntime(request),
    }),
  );

  if (shouldDisableCaching(request.nextUrl.pathname)) {
    response.headers.set("cache-control", "no-store, max-age=0");
  }

  return response;
}
