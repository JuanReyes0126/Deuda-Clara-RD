import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/security/origin";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { logServerInfo } from "@/server/observability/logger";

const telemetrySchema = z.object({
  event: z.enum([
    "upgrade_click",
    "feature_blocked",
    "simulator_used",
    "simulator_portfolio_run",
    "debt_limit_hit",
    "premium_preview_seen",
    "dashboard_daily_mission_click",
  ]),
  path: z.string().trim().min(1).max(256),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const parsed = telemetrySchema.safeParse(await request.json());

    if (!parsed.success) {
      return apiBadRequest("Evento inválido.");
    }

    logServerInfo("product:plan_event", {
      event: parsed.data.event,
      path: parsed.data.path,
      ...parsed.data.meta,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo registrar el evento.");
  }
}
