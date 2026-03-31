import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/server/auth/auth-service";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);

  const parsed = forgotPasswordSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
      },
      { status: 400 },
    );
  }

  const rateLimit = await assertRateLimit({
    key: `forgot-password:${parsed.data.email}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Demasiados intentos. Espera un momento antes de volver a probar.",
      },
      { status: 429 },
    );
  }

  await requestPasswordReset(parsed.data, getRequestMeta(request));

  return NextResponse.json({ ok: true });
}
