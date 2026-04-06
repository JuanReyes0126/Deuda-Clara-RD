import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { getRequestMeta } from "@/lib/security/request-meta";
import { assertRecentAuth } from "@/lib/security/recent-auth";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import {
  disableTotpSchema,
  regenerateRecoveryCodesSchema,
  verifyTotpSetupSchema,
} from "@/lib/validations/auth";
import {
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from "@/server/api/api-response";
import {
  createUserTotpSetup,
  disableUserTotp,
  regenerateUserRecoveryCodes,
  verifyUserTotpSetup,
} from "@/server/settings/settings-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const requestMeta = getRequestMeta(request);
    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "mfa-totp-setup", session.user.id),
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        rateLimit.resetAt,
      );
    }

    const body = await request.json().catch(() => ({}));
    const action =
      body && typeof body === "object" && "action" in body
        ? body.action
        : "setup";

    if (action === "regenerate-recovery-codes") {
      const parsed = regenerateRecoveryCodesSchema.safeParse(body);

      if (!parsed.success) {
        return apiBadRequest(
          parsed.error.issues[0]?.message ?? "Datos inválidos.",
        );
      }

      const result = await regenerateUserRecoveryCodes(
        session.user.id,
        parsed.data,
        requestMeta,
      );

      return NextResponse.json({ ok: true, recovery: result });
    }

    const setup = await createUserTotpSetup(session.user.id, requestMeta);

    return NextResponse.json({ ok: true, setup });
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo preparar la verificación en dos pasos.",
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const parsed = verifyTotpSetupSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(
        parsed.error.issues[0]?.message ?? "Datos inválidos.",
      );
    }

    const result = await verifyUserTotpSetup(
      session.user.id,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, mfa: result });
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo activar la verificación en dos pasos.",
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await assertRecentAuth(session.user.id);

    const parsed = disableTotpSchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest(
        parsed.error.issues[0]?.message ?? "Datos inválidos.",
      );
    }

    const result = await disableUserTotp(
      session.user.id,
      parsed.data,
      getRequestMeta(request),
    );

    return NextResponse.json({ ok: true, mfa: result });
  } catch (error) {
    return handleApiError(
      error,
      "No se pudo desactivar la verificación en dos pasos.",
    );
  }
}
