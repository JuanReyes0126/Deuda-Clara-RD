import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { membershipPlanSchema } from "@/lib/validations/membership";
import {
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from "@/server/api/api-response";
import { isBillingConfigured } from "@/server/billing/billing-service";
import { updateUserMembershipPlan } from "@/server/settings/settings-service";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "membership:update", session.user.id),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiados intentos de actualizar membresía. Intenta más tarde.",
        rateLimit.resetAt,
      );
    }

    const parsed = membershipPlanSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    if (parsed.data.membershipTier !== "FREE") {
      return apiBadRequest(
        "Los planes pagos solo se activan por checkout seguro.",
        403,
      );
    }

    if (isBillingConfigured()) {
      return apiBadRequest(
        "La membresía se gestiona desde checkout y el portal de facturación.",
        403,
      );
    }

    const membership = await updateUserMembershipPlan(
      session.user.id,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, membership });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el plan.");
  }
}
