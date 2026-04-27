import { NextRequest, NextResponse } from "next/server";

import { createUserSession } from "@/lib/auth/session";
import {
  clearPasskeyChallengeCookie,
  readPasskeyChallengeCookie,
} from "@/lib/security/passkeys";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { verifyPasskeyAuthentication } from "@/server/auth/passkey-service";
import { generateOpaqueToken } from "@/server/auth/tokens";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const challenge = readPasskeyChallengeCookie(request, "authentication");

    if (!challenge) {
      return apiBadRequest(
        "La verificación con passkey expiró. Vuelve a intentarlo.",
      );
    }

    const requestMeta = getRequestMeta(request);
    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "passkey-login-verify", challenge.userId),
      limit: 15,
      windowMs: 10 * 60 * 1000,
      requireDistributedStore: true,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    const body = await request.json().catch(() => null);
    const credential =
      body && typeof body === "object" && "credential" in body
        ? body.credential
        : null;

    if (!credential || typeof credential !== "object") {
      return apiBadRequest("No pudimos leer la passkey enviada.");
    }

    const user = await verifyPasskeyAuthentication(
      credential as never,
      challenge.challenge,
      challenge.userId,
      request,
      requestMeta,
    );

    const rawToken = generateOpaqueToken();
    await createUserSession(user.id, rawToken);

    const response = NextResponse.json({
      ok: true,
      redirectTo: user.onboardingCompleted ? "/dashboard" : "/onboarding",
    });
    clearPasskeyChallengeCookie(response, "authentication");

    return response;
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo completar el acceso con passkey.",
    );
  }
}
