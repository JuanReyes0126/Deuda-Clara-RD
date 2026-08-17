import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertSameOrigin } from "@/lib/security/origin";
import { onboardingSchema } from "@/lib/validations/settings";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { completeUserOnboarding } from "@/server/onboarding/onboarding-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = onboardingSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const requestMeta = getRequestMeta(request);
    const preview = await completeUserOnboarding(
      session.user.id,
      parsed.data,
      requestMeta,
    );

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return handleApiError(error, "No se pudo completar el onboarding.");
  }
}
