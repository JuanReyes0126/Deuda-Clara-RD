import { NextRequest, NextResponse } from "next/server";

import {
  attachPasskeyChallengeCookie,
} from "@/lib/security/passkeys";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { createPasskeyAuthenticationOptions } from "@/server/auth/passkey-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const body = await request.json().catch(() => ({}));
    const email =
      body && typeof body === "object" && "email" in body && typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiBadRequest("Correo electrónico inválido.");
    }

    const requestMeta = getRequestMeta(request);
    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "passkey-login-options", email),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    const result = await createPasskeyAuthenticationOptions(
      email,
      request,
      requestMeta,
    );

    const response = NextResponse.json({
      ok: true,
      options: result.options,
    });

    attachPasskeyChallengeCookie(response, "authentication", {
      challenge: result.options.challenge,
      userId: result.userId,
    });

    return response;
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo preparar el acceso con passkey.",
    );
  }
}
