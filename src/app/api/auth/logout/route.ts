import { NextRequest, NextResponse } from "next/server";

import { destroyCurrentSession } from "@/lib/auth/session";
import { buildRedirectUrl } from "@/lib/http/request-origin";
import { assertSameOrigin } from "@/lib/security/origin";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);
  await destroyCurrentSession();

  const redirectTo = request.nextUrl.searchParams.get("redirectTo");

  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    return NextResponse.redirect(buildRedirectUrl(request, redirectTo), 303);
  }

  return NextResponse.json({ ok: true });
}
