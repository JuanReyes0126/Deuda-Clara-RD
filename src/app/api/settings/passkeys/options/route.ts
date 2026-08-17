import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import {
  attachPasskeyChallengeCookie,
} from "@/lib/security/passkeys";
import { assertSameOrigin } from "@/lib/security/origin";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { createPasskeyRegistrationOptions } from "@/server/auth/passkey-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "passkey-registration-options", session.user.id),
      limit: 5,
      windowMs: 10 * 60 * 1000,
      requireDistributedStore: true,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    const result = await createPasskeyRegistrationOptions(
      session.user.id,
      request,
    );

    const response = NextResponse.json({
      ok: true,
      options: result.options,
    });
    attachPasskeyChallengeCookie(response, "registration", {
      challenge: result.options.challenge,
      userId: session.user.id,
    });

    return response;
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo preparar la passkey.",
    );
  }
}
