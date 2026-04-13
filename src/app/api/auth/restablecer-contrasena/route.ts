import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { resetPassword } from "@/server/auth/auth-service";
import { logSecurityEvent } from "@/server/observability/logger";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const requestMeta = getRequestMeta(request);

    const parsed = resetPasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "reset-password", parsed.data.token),
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_reset_password", {
        ipAddress: requestMeta.ipAddress,
      });
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    await resetPassword(parsed.data, requestMeta);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo restablecer la contraseña.");
  }
}
