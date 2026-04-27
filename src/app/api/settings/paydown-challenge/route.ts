import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import {
  clearPaydownChallenge,
  startPaydownChallenge,
} from "@/server/settings/paydown-challenge-service";

const startBodySchema = z.object({
  extraMonthly: z
    .number()
    .finite("Debes indicar un monto válido.")
    .positive("El monto extra debe ser mayor que cero.")
    .max(999_999_999, "El monto es demasiado alto."),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = startBodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    await startPaydownChallenge(session.user.id, parsed.data.extraMonthly);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo activar el reto.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await clearPaydownChallenge(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo cerrar el reto.");
  }
}
