import { NextResponse } from "next/server";

import {
  ServiceError,
  isServiceError,
} from "@/server/services/service-error";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { logServerError } from "@/server/observability/logger";

function jsonWithDefaults(body: Record<string, unknown>, init: ResponseInit) {
  const headers = new Headers(init.headers);

  if ((init.status ?? 200) >= 400 || (init.status ?? 200) === 401 || (init.status ?? 200) === 403) {
    headers.set("cache-control", "no-store, max-age=0");
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function apiBadRequest(message: string, status = 400) {
  return jsonWithDefaults({ error: message }, { status });
}

export function apiRateLimited(message: string, resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return jsonWithDefaults(
    { error: message },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfter),
        "x-ratelimit-reset": String(resetAt),
      },
    },
  );
}

export function handleApiError(error: unknown, fallbackMessage = "Ocurrió un error interno.") {
  if (isServiceError(error)) {
    return jsonWithDefaults(
      {
        error: error.message,
        ...(error.code === "REAUTH_REQUIRED" ? { reauthRequired: true } : {}),
      },
      { status: error.status },
    );
  }

  if (isInfrastructureUnavailableError(error)) {
    logServerError("Infrastructure unavailable during API request", {
      fallbackMessage,
      error,
    });

    return jsonWithDefaults(
      {
        error: "El servicio no está disponible ahora mismo. Verifica la base de datos o inténtalo de nuevo en unos minutos.",
      },
      { status: 503 },
    );
  }

  if (error instanceof SyntaxError) {
    return jsonWithDefaults({ error: "No se pudo leer la solicitud." }, { status: 400 });
  }

  logServerError("Unhandled API request failure", {
    fallbackMessage,
    error,
  });

  return jsonWithDefaults({ error: fallbackMessage }, { status: 500 });
}

export function assertFound<T>(value: T | null | undefined, message = "Recurso no encontrado.") {
  if (!value) {
    throw new ServiceError("RESOURCE_NOT_FOUND", 404, message);
  }

  return value;
}
