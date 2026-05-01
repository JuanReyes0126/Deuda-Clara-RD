import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { deleteUserPasskey } from "@/server/auth/passkey-service";

type RouteContext = {
  params: Promise<{
    passkeyId: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "passkey-delete", session.user.id),
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

    const { passkeyId } = await context.params;
    const result = await deleteUserPasskey(
      session.user.id,
      passkeyId,
      getRequestMeta(request),
    );

    return NextResponse.json({
      ok: true,
      passkeys: result.passkeys,
    });
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo eliminar la passkey.",
    );
  }
}
