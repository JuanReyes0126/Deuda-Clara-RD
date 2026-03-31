import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { checkoutPlanSchema } from "@/lib/validations/billing";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { createMembershipCheckoutSession } from "@/server/billing/billing-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = checkoutPlanSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const result = await createMembershipCheckoutSession(
      session.user.id,
      parsed.data.membershipTier,
      getRequestMeta(request),
      parsed.data.sourceContext ?? "planes",
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "No se pudo iniciar el checkout.");
  }
}
