import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { createBillingPortalSession } from "@/server/billing/billing-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const result = await createBillingPortalSession(
      session.user.id,
      getRequestMeta(request),
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "No se pudo abrir la facturación.");
  }
}
