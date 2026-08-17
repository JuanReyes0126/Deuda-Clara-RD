import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import {
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from "@/server/api/api-response";
import { markAllNotificationsAsRead } from "@/server/notifications/notification-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "notifications:read-all", session.user.id),
      limit: 50,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiadas solicitudes para actualizar notificaciones. Intenta más tarde.",
        rateLimit.resetAt,
      );
    }

    await markAllNotificationsAsRead(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudieron marcar las notificaciones.");
  }
}
