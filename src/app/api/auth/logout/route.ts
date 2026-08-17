import { NextRequest, NextResponse } from "next/server";

import { destroyCurrentSession } from "@/lib/auth/session";
import { buildRedirectUrl } from "@/lib/http/request-origin";
import { assertSameOrigin } from "@/lib/security/origin";
import { handleApiError } from "@/server/api/api-response";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await destroyCurrentSession();

    const redirectTo = request.nextUrl.searchParams.get("redirectTo");

    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      return NextResponse.redirect(buildRedirectUrl(request, redirectTo), 303);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "No se pudo cerrar la sesión.");
  }
}
