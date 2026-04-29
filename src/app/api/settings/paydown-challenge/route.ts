import { NextRequest, NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { apiBadRequest, apiRateLimited, handleApiError } from "@/server/api/api-response";
import { createAuditLog } from "@/server/audit/audit-service";
import { logSecurityEvent } from "@/server/observability/logger";
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

async function assertChallengeRateLimit(
  request: NextRequest,
  userId: string,
  operation: "start" | "clear",
) {
  const rateLimit = await assertRateLimit({
    key: buildRateLimitKey(request, `paydown-challenge-${operation}`, userId),
    limit: operation === "start" ? 8 : 12,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.success) {
    logSecurityEvent("rate_limit_settings_update", {
      route: request.nextUrl.pathname,
      userId,
      ipAddress: getRequestMeta(request).ipAddress,
      operation,
    });
    return apiRateLimited(
      "Demasiados intentos. Intenta de nuevo más tarde.",
      rateLimit.resetAt,
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }
    const requestMeta = getRequestMeta(request);
    const rateLimitedResponse = await assertChallengeRateLimit(
      request,
      session.user.id,
      "start",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    const parsed = startBodySchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message ?? "Datos inválidos.");
    }

    await startPaydownChallenge(session.user.id, parsed.data.extraMonthly);
    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      resourceType: "settings",
      resourceId: session.user.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      metadata: {
        area: "paydown_challenge",
        operation: "start",
        extraMonthly: parsed.data.extraMonthly,
      },
    });

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
    const requestMeta = getRequestMeta(request);
    const rateLimitedResponse = await assertChallengeRateLimit(
      request,
      session.user.id,
      "clear",
    );

    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    await clearPaydownChallenge(session.user.id);
    await createAuditLog({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      resourceType: "settings",
      resourceId: session.user.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      metadata: {
        area: "paydown_challenge",
        operation: "clear",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo cerrar el reto.");
  }
}
