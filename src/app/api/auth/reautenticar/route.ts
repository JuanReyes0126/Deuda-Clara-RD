import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { refreshRecentAuth } from "@/lib/security/recent-auth";
import { reauthenticateSchema } from "@/lib/validations/auth";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { reauthenticateUser } from "@/server/auth/auth-service";
import { logSecurityEvent } from "@/server/observability/logger";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const requestMeta = getRequestMeta(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = reauthenticateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "reauth", session.user.id),
      limit: 8,
      windowMs: 10 * 60 * 1000,
      requireDistributedStore: true,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_reauth", {
        userId: session.user.id,
        ipAddress: requestMeta.ipAddress,
      });
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    await reauthenticateUser(session.user.id, parsed.data, requestMeta);
    await refreshRecentAuth(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo confirmar tu identidad.");
  }
}
