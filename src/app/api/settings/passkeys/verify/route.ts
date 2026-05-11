import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  clearPasskeyChallengeCookie,
  readPasskeyChallengeCookie,
} from "@/lib/security/passkeys";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { verifyPasskeyRegistration } from "@/server/auth/passkey-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const challenge = readPasskeyChallengeCookie(request, "registration");

    if (!challenge || challenge.userId !== session.user.id) {
      return apiBadRequest(
        "La verificación con passkey expiró. Vuelve a intentarlo.",
      );
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "passkey-registration-verify", session.user.id),
      limit: 10,
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
    const name =
      body && typeof body === "object" && "name" in body && typeof body.name === "string"
        ? body.name
        : undefined;

    if (!credential || typeof credential !== "object") {
      return apiBadRequest("No pudimos leer la passkey enviada.");
    }

    const result = await verifyPasskeyRegistration(
      session.user.id,
      credential as never,
      challenge.challenge,
      request,
      getRequestMeta(request),
      name,
    );

    const response = NextResponse.json({
      ok: true,
      passkey: result.passkey,
      passkeys: result.passkeys,
    });
    clearPasskeyChallengeCookie(response, "registration");

    return response;
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo registrar la passkey.",
    );
  }
}
