import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { membershipPlanSchema } from "@/lib/validations/membership";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { isStripeBillingConfigured } from "@/server/billing/billing-service";
import { updateUserMembershipPlan } from "@/server/settings/settings-service";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = membershipPlanSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    if (isStripeBillingConfigured()) {
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
