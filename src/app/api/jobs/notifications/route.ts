import { NextRequest, NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import { handleApiError } from "@/server/api/api-response";
import { dispatchPendingNotificationEmails } from "@/server/notifications/notification-service";
import { dispatchAutomatedReminderEmails } from "@/server/reminders/reminder-scheduler-service";
import { logSecurityEvent } from "@/server/observability/logger";

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-cron-secret");
    const env = getServerEnv();

    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
      logSecurityEvent("cron_secret_rejected", {
        route: "/api/jobs/notifications",
      });
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "cron-notifications"),
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      logSecurityEvent("rate_limit_cron_notifications", {
        route: "/api/jobs/notifications",
      });
      return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
    }

    const [reminderStats, digestStats] = await Promise.all([
      dispatchAutomatedReminderEmails(),
      dispatchPendingNotificationEmails(),
    ]);

    return NextResponse.json({
      ok: true,
      processedAt: new Date().toISOString(),
      stats: {
        reminders: reminderStats,
        digests: digestStats,
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudieron enviar recordatorios.");
  }
}
