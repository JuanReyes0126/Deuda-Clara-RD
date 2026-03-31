import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { markAllNotificationsAsRead } from "@/server/notifications/notification-service";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    await markAllNotificationsAsRead(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudieron marcar las notificaciones.");
  }
}
