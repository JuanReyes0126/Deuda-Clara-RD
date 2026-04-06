import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { profileSchema } from "@/lib/validations/profile";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { updateUserProfile } from "@/server/settings/settings-service";

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = profileSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const user = await updateUserProfile(
      session.user.id,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({
      ok: true,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar el perfil.");
  }
}
