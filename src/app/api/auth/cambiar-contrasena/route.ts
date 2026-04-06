import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { changePasswordSchema } from "@/lib/validations/auth";
import { apiRateLimited } from "@/server/api/api-response";
import { changePassword } from "@/server/auth/auth-service";
import { logSecurityEvent, logServerError } from "@/server/observability/logger";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { isServiceError } from "@/server/services/service-error";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const requestMeta = getRequestMeta(request);

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    await assertRecentAuth(session.user.id);

    const parsed = changePasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
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
    if (isServiceError(error)) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.code === "REAUTH_REQUIRED" ? { reauthRequired: true } : {}),
        },
        { status: error.status },
      );
    }

    if (isInfrastructureUnavailableError(error)) {
      return NextResponse.json(
        {
          error: "El cambio de contraseña no está disponible ahora mismo. Intenta de nuevo más tarde.",
        },
        { status: 503 },
      );
    }

    logServerError("Change password route failed", { error });
    return NextResponse.json(
      { error: "No se pudo cambiar la contraseña." },
      { status: 500 },
    );
  }
}
