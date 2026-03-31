import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { paymentSchema } from "@/lib/validations/payments";
import { deletePayment, updatePayment } from "@/server/payments/payment-service";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";

type RouteContext = {
  params: Promise<{
    paymentId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const parsed = paymentSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const { paymentId } = await context.params;
    const payment = await updatePayment(
      session.user.id,
      paymentId,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, payment });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest(
        "No pudimos guardar los cambios de este pago ahora mismo. Inténtalo de nuevo en unos minutos.",
        503,
      );
    }

    return handleApiError(error, "No pudimos guardar los cambios del pago.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const { paymentId } = await context.params;
    await deletePayment(session.user.id, paymentId, getRequestMeta(request));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest(
        "No pudimos eliminar este pago ahora mismo. Inténtalo de nuevo en unos minutos.",
        503,
      );
    }

    return handleApiError(error, "No pudimos eliminar este pago ahora mismo.");
  }
}
