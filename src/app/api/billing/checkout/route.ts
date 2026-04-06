import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { checkoutPlanSchema } from "@/lib/validations/billing";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { createMembershipCheckoutSession } from "@/server/billing/billing-service";
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

    const parsed = checkoutPlanSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "billing-checkout", session.user.id, parsed.data.membershipTier),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_billing_checkout", {
        userId: session.user.id,
        membershipTier: parsed.data.membershipTier,
        ipAddress: requestMeta.ipAddress,
      });
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    const result = await createMembershipCheckoutSession(
      session.user.id,
      parsed.data.membershipTier,
      requestMeta,
      parsed.data.sourceContext ?? "planes",
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "No se pudo iniciar el checkout.");
  }
}
