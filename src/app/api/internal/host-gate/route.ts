import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { HOST_PANEL_ROUTE } from "@/lib/host/panel";
import { assertSameOrigin } from "@/lib/security/origin";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { logSecurityEvent, logServerWarn } from "@/server/observability/logger";
import {
  assertHostPanelApiAccess,
  setHostPanelGateCookie,
  verifyHostSecondaryPassword,
} from "@/server/host/host-access";

const hostGateSchema = z.object({
  password: z.string().min(1, "La clave secundaria es obligatoria."),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const decision = await assertHostPanelApiAccess({
      allowMissingSecondary: true,
    });

    if (decision.outcome === "LOGIN") {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    if (decision.outcome === "NOT_FOUND") {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }

    if (decision.outcome === "MFA_SETUP_REQUIRED") {
      return NextResponse.json(
        { error: "Activa MFA en Configuración antes de usar el panel interno." },
        { status: 403 },
      );
    }

    const parsed = hostGateSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
        { status: 400 },
      );
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "host-gate", decision.user.id),
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_host_gate", {
        userId: decision.user.id,
      });
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta más tarde." },
        { status: 429 },
      );
    }

    const validPassword = await verifyHostSecondaryPassword(parsed.data.password);

    if (!validPassword) {
      logServerWarn("Host secondary password rejected", {
        email: decision.user.email,
      });
      return NextResponse.json(
        { error: "La clave secundaria no coincide." },
        { status: 401 },
      );
    }

    await setHostPanelGateCookie();

    return NextResponse.json({ ok: true, redirectTo: HOST_PANEL_ROUTE });
  } catch {
    return NextResponse.json(
      { error: "No se pudo desbloquear el panel interno." },
      { status: 500 },
    );
  }
}
