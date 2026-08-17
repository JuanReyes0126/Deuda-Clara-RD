import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import {
  assertRateLimit,
  buildRateLimitKey,
} from "@/lib/security/rate-limit";
import { paymentSchema } from "@/lib/validations/payments";
import { createPayment, listUserPayments } from "@/server/payments/payment-service";
import {
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from "@/server/api/api-response";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const payments = await listUserPayments(session.user.id);

    return NextResponse.json({ payments });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest(
        "No pudimos cargar tu historial de pagos ahora mismo. Inténtalo de nuevo en unos minutos.",
        503,
      );
    }

    return handleApiError(error, "No pudimos cargar el historial de pagos.");
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "payments:create", session.user.id),
      limit: 40,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiados registros de pago. Intenta más tarde.",
        rateLimit.resetAt,
      );
    }

    const parsed = paymentSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const payment = await createPayment(
      session.user.id,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, payment });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest(
        "No pudimos registrar este pago ahora mismo. Inténtalo de nuevo en unos minutos.",
        503,
      );
    }

    return handleApiError(error, "No pudimos registrar el pago. Revisa el monto e inténtalo otra vez.");
  }
}
