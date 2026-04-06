import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertSameOrigin } from "@/lib/security/origin";
import { onboardingSchema } from "@/lib/validations/settings";
import { completeUserOnboarding } from "@/server/onboarding/onboarding-service";

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

  const requestMeta = getRequestMeta(request);
  const preview = await completeUserOnboarding(
    session.user.id,
    parsed.data,
    requestMeta,
  );

  return NextResponse.json({ ok: true, preview });
}
