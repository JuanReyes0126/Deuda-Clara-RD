import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { requestPasswordReset } from "@/server/auth/auth-service";
import { logSecurityEvent } from "@/server/observability/logger";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const requestMeta = getRequestMeta(request);

    const parsed = forgotPasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "forgot-password", parsed.data.email),
      limit: 5,
      windowMs: 10 * 60 * 1000,
      requireDistributedStore: true,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_forgot_password", {
        email: parsed.data.email,
        ipAddress: requestMeta.ipAddress,
      });
      return apiRateLimited(
        "Demasiados intentos. Espera un momento antes de volver a probar.",
        rateLimit.resetAt,
      );
    }

    await requestPasswordReset(parsed.data, requestMeta);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo procesar la recuperación de contraseña.");
  }
}
