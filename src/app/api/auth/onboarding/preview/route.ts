import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { onboardingSchema } from "@/lib/validations/settings";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { buildOnboardingPreview } from "@/server/onboarding/onboarding-service";

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

    return NextResponse.json(buildOnboardingPreview(parsed.data));
  } catch (error) {
    return handleApiError(error, "No se pudo calcular la vista previa del onboarding.");
  }
}
