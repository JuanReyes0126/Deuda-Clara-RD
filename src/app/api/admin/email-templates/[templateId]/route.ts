import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { emailTemplateSchema } from "@/lib/validations/admin";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { updateEmailTemplate } from "@/server/admin/admin-service";
import { assertHostPanelApiAccess } from "@/server/host/host-access";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);

    const decision = await assertHostPanelApiAccess();

    if (decision.outcome === "LOGIN") {
      return apiBadRequest("No autenticado.", 401);
    }

    if (decision.outcome !== "GRANTED") {
      return apiBadRequest("No encontrado.", 404);
    }

    const parsed = emailTemplateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const { templateId } = await context.params;
    const template = await updateEmailTemplate(
      decision.user.id,
      templateId,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar la plantilla.");
  }
}
