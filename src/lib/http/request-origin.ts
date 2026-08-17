import type { NextRequest } from "next/server";

import { getServerEnv } from "@/lib/env/server";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? null;
}

export function getRequestOrigin(request: NextRequest) {
  const forwardedHost = firstHeaderValue(
    request.headers.get("x-forwarded-host"),
  );
  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto"),
  );

  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  const origin = firstHeaderValue(request.headers.get("origin"));

  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const host = firstHeaderValue(request.headers.get("host"));

  if (host) {
    const protocol = request.nextUrl.protocol.replace(/:$/, "") || "http";
    return `${protocol}://${host}`;
  }

  return getServerEnv().APP_URL ?? request.nextUrl.origin;
}

export function buildRedirectUrl(request: NextRequest, pathname: string) {
  return new URL(pathname, `${getRequestOrigin(request)}/`);
}
