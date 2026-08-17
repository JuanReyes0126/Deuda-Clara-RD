import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { HOST_PANEL_UNLOCK_ROUTE } from "@/lib/host/panel";
import { getAllowedOriginsForRequest } from "@/lib/security/origin";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { handleApiError } from "@/server/api/api-response";
import { logSecurityEvent } from "@/server/observability/logger";
import { assertHostPanelApiAccess } from "@/server/host/host-access";

export const dynamic = "force-dynamic";
const HOST_ACCESS_INTERNAL_HEADER = "x-deuda-clara-host-access";

function hasTrustedRequestOrigin(request: NextRequest) {
  const candidate = request.headers.get("origin") ?? request.headers.get("referer");

  if (!candidate) {
    return true;
  }

  const allowedOrigins = getAllowedOriginsForRequest(request);

  try {
    return allowedOrigins.has(new URL(candidate).origin);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "host-access", request.nextUrl.pathname),
      limit: 120,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.success) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const internalHeader = request.headers.get(HOST_ACCESS_INTERNAL_HEADER);
    const expectedSecret = getServerEnv().AUTH_SECRET;

    if (!internalHeader || !expectedSecret || internalHeader !== expectedSecret) {
      logSecurityEvent("host_access_route_blocked", {
        pathname: request.nextUrl.pathname,
        ipAddress:
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          undefined,
      });
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    if (!hasTrustedRequestOrigin(request)) {
      logSecurityEvent("host_access_origin_blocked", {
        pathname: request.nextUrl.pathname,
        origin: request.headers.get("origin") ?? undefined,
        referer: request.headers.get("referer") ?? undefined,
      });
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const pathname = request.nextUrl.searchParams.get("pathname") ?? "/host";
    const allowMissingSecondary = pathname === HOST_PANEL_UNLOCK_ROUTE;
    const decision = await assertHostPanelApiAccess({ allowMissingSecondary });

    if (decision.outcome === "LOGIN") {
      return NextResponse.json({ ok: false, outcome: "LOGIN" }, { status: 200 });
    }

    if (decision.outcome === "NOT_FOUND") {
      return NextResponse.json({ ok: false, outcome: "NOT_FOUND" }, { status: 200 });
    }

    if (decision.outcome === "MFA_SETUP_REQUIRED") {
      return NextResponse.json({ ok: false, outcome: "MFA_SETUP_REQUIRED" }, { status: 200 });
    }

    if (decision.outcome === "SECONDARY_REQUIRED") {
      return NextResponse.json({ ok: false, outcome: "SECONDARY_REQUIRED" }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "No se pudo validar el acceso interno.");
  }
}
