import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { handleApiError } from "@/server/api/api-response";
import { dispatchPendingNotificationEmails } from "@/server/notifications/notification-service";

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-cron-secret");
    const env = getServerEnv();

    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const stats = await dispatchPendingNotificationEmails();

    return NextResponse.json({
      ok: true,
      processedAt: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    return handleApiError(error, "No se pudieron enviar recordatorios.");
  }
}
