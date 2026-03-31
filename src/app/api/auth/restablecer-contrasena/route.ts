import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPassword } from "@/server/auth/auth-service";
import { logServerError } from "@/server/observability/logger";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { isServiceError } from "@/server/services/service-error";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const parsed = resetPasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }

    await resetPassword(parsed.data, getRequestMeta(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isInfrastructureUnavailableError(error)) {
      return NextResponse.json(
        {
          error: "El restablecimiento no está disponible ahora mismo. Intenta de nuevo en unos minutos.",
        },
        { status: 503 },
      );
    }

    logServerError("Reset password route failed", { error });
    return NextResponse.json(
      { error: "No se pudo restablecer la contraseña." },
      { status: 500 },
    );
  }
}
