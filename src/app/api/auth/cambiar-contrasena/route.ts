import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { changePasswordSchema } from "@/lib/validations/auth";
import { changePassword } from "@/server/auth/auth-service";
import { logServerError } from "@/server/observability/logger";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { isServiceError } from "@/server/services/service-error";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const parsed = changePasswordSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }

    await changePassword(session.user.id, parsed.data, getRequestMeta(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isInfrastructureUnavailableError(error)) {
      return NextResponse.json(
        {
          error: "El cambio de contraseña no está disponible ahora mismo. Intenta de nuevo más tarde.",
        },
        { status: 503 },
      );
    }

    logServerError("Change password route failed", { error });
    return NextResponse.json(
      { error: "No se pudo cambiar la contraseña." },
      { status: 500 },
    );
  }
}
