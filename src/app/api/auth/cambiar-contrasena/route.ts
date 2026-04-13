import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { changePassword } from "@/server/auth/auth-service";
import { logSecurityEvent } from "@/server/observability/logger";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const requestMeta = getRequestMeta(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const parsed = changePasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "change-password", session.user.id),
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_change_password", {
        userId: session.user.id,
        ipAddress: requestMeta.ipAddress,
      });
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    await changePassword(session.user.id, parsed.data, requestMeta);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo cambiar la contraseña.");
  }
}
