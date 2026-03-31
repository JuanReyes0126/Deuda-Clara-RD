import type { NextRequest } from "next/server";

import { ServiceError } from "@/server/services/service-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
    return;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const host = request.headers.get("host");

  if (!host) {
    throw new ServiceError("ORIGIN_HOST_MISSING", 400, "No se pudo validar la solicitud.");
  }

  const originUrl = new URL(origin);

  if (originUrl.host !== host) {
    throw new ServiceError("ORIGIN_NOT_ALLOWED", 403, "La solicitud fue bloqueada por seguridad.");
  }
}
