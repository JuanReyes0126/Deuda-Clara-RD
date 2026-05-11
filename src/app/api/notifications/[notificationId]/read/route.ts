import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { assertRateLimit, buildRateLimitKey } from "@/lib/security/rate-limit";
import {
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from "@/server/api/api-response";
import { markNotificationAsRead } from "@/server/notifications/notification-service";

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const rateLimit = await assertRateLimit({
      key: buildRateLimitKey(request, "notifications:read-one", session.user.id),
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.success) {
      return apiRateLimited(
        "Demasiadas solicitudes para actualizar notificaciones. Intenta más tarde.",
        rateLimit.resetAt,
      );
    }

    const { notificationId } = await context.params;
    const notification = await markNotificationAsRead(session.user.id, notificationId);

    return NextResponse.json({ ok: true, notification });
  } catch (error) {
    return handleApiError(error, "No se pudo actualizar la notificación.");
  }
}
