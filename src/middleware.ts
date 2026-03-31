import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  HOST_PANEL_ROUTE,
  HOST_PANEL_SESSION_COOKIE,
  HOST_PANEL_UNLOCK_ROUTE,
  isHostPanelEnabledFlag,
} from "@/lib/host/panel";

async function checkHostAccess(request: NextRequest) {
  const accessUrl = new URL("/api/internal/host-access", request.url);
  accessUrl.searchParams.set("pathname", request.nextUrl.pathname);

  return fetch(accessUrl, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });
}

function attachNoIndexHeader(response: NextResponse) {
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isInternalRoute =
    pathname.startsWith("/host") || pathname.startsWith("/admin");

  if (!isInternalRoute) {
    return NextResponse.next();
  }

  if (!isHostPanelEnabledFlag(process.env.HOST_PANEL_ENABLED)) {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  if (!request.cookies.get(HOST_PANEL_SESSION_COOKIE)?.value) {
    const loginUrl = new URL("/login", request.url);
    return attachNoIndexHeader(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith("/admin")) {
    return attachNoIndexHeader(
      NextResponse.redirect(new URL(HOST_PANEL_ROUTE, request.url)),
    );
  }

  const accessResponse = await checkHostAccess(request);

  if (accessResponse.status === 200) {
    return attachNoIndexHeader(NextResponse.next());
  }

  if (accessResponse.status === 401) {
    return attachNoIndexHeader(
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  if (
    accessResponse.status === 428 &&
    pathname !== HOST_PANEL_UNLOCK_ROUTE
  ) {
    return attachNoIndexHeader(
      NextResponse.redirect(new URL(HOST_PANEL_UNLOCK_ROUTE, request.url)),
    );
  }

  if (accessResponse.status === 428 && pathname === HOST_PANEL_UNLOCK_ROUTE) {
    return attachNoIndexHeader(NextResponse.next());
  }

  return attachNoIndexHeader(NextResponse.rewrite(new URL("/404", request.url)));
}

export const config = {
  matcher: ["/host/:path*", "/admin/:path*"],
};
