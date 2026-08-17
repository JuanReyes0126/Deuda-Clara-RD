import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { preferencesSchema } from "@/lib/validations/profile";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { updateUserPreferences } from "@/server/settings/settings-service";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = preferencesSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const settings = await updateUserPreferences(
      session.user.id,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar la configuración.");
  }
}
