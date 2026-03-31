import { NextRequest, NextResponse } from "next/server";

import { HOST_PANEL_UNLOCK_ROUTE } from "@/lib/host/panel";
import { assertHostPanelApiAccess } from "@/server/host/host-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get("pathname") ?? "/host";
  const allowMissingSecondary = pathname === HOST_PANEL_UNLOCK_ROUTE;
  const decision = await assertHostPanelApiAccess({ allowMissingSecondary });

  if (decision.outcome === "LOGIN") {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (decision.outcome === "NOT_FOUND") {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  if (decision.outcome === "SECONDARY_REQUIRED") {
    return NextResponse.json(
      { error: "Verificación adicional requerida." },
      { status: 428 },
    );
  }

  return NextResponse.json({ ok: true });
}
