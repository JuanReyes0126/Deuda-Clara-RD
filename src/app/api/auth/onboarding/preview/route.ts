import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { onboardingSchema } from "@/lib/validations/settings";
import { buildOnboardingPreview } from "@/server/onboarding/onboarding-service";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = onboardingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  return NextResponse.json(buildOnboardingPreview(parsed.data));
}
