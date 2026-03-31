import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { debtSchema } from "@/lib/validations/debts";
import { deleteDebt, getDebtById, updateDebt } from "@/server/debts/debt-service";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";

type RouteContext = {
  params: Promise<{
    debtId: string;
  }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const { debtId } = await context.params;
    const debt = await getDebtById(session.user.id, debtId);

    return NextResponse.json({ debt });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest("No pudimos cargar esta deuda ahora mismo. Inténtalo de nuevo en unos minutos.", 503);
    }

    return handleApiError(error, "No se pudo cargar la deuda.");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  let parsedStatus: string | undefined;

  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = debtSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    parsedStatus = parsed.data.status;

    const { debtId } = await context.params;
    const debt = await updateDebt(
      session.user.id,
      debtId,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, debt });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest(
        parsedStatus === "ARCHIVED"
          ? "No pudimos archivar esta deuda ahora mismo. Inténtalo de nuevo en unos minutos."
          : "No pudimos guardar los cambios de esta deuda. Inténtalo de nuevo en unos minutos.",
        503,
      );
    }

    return handleApiError(error, "No se pudo actualizar la deuda.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const { debtId } = await context.params;
    await deleteDebt(session.user.id, debtId, getRequestMeta(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest("No pudimos eliminar esta deuda ahora mismo. Inténtalo de nuevo en unos minutos.", 503);
    }

    return handleApiError(error, "No se pudo eliminar la deuda.");
  }
}
