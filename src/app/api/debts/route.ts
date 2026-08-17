import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import {
  assertRateLimit,
  buildRateLimitKey,
} from "@/lib/security/rate-limit";
import { debtSchema } from "@/lib/validations/debts";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { listUserDebts, createDebt } from "@/server/debts/debt-service";
import {
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from "@/server/api/api-response";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const debts = await listUserDebts(session.user.id);

    return NextResponse.json({ debts });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest("No pudimos cargar tus deudas ahora mismo. Inténtalo de nuevo en unos minutos.", 503);
    }

    return handleApiError(error, "No se pudieron cargar las deudas.");
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
      key: buildRateLimitKey(request, "debts:create", session.user.id),
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiadas creaciones de deudas. Intenta más tarde.",
        rateLimit.resetAt,
      );
    }

    const parsed = debtSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    const debt = await createDebt(session.user.id, parsed.data, getRequestMeta(request));

    return NextResponse.json({ ok: true, debt });
  } catch (error) {
    if (isInfrastructureUnavailableError(error)) {
      return apiBadRequest("No pudimos crear la deuda ahora mismo. Inténtalo de nuevo en unos minutos.", 503);
    }

    return handleApiError(error, "No se pudo crear la deuda.");
  }
}
