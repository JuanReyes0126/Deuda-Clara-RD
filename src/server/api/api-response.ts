import { NextResponse } from "next/server";

import {
  ServiceError,
  isServiceError,
} from "@/server/services/service-error";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";
import { logServerError } from "@/server/observability/logger";

export function apiBadRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown, fallbackMessage = "Ocurrió un error interno.") {
  if (isServiceError(error)) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (isInfrastructureUnavailableError(error)) {
    logServerError("Infrastructure unavailable during API request", {
      fallbackMessage,
      error,
    });

    return NextResponse.json(
      {
        error: "El servicio no está disponible ahora mismo. Verifica la base de datos o inténtalo de nuevo en unos minutos.",
      },
      { status: 503 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "No se pudo leer la solicitud." }, { status: 400 });
  }

  logServerError("Unhandled API request failure", {
    fallbackMessage,
    error,
  });

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export function assertFound<T>(value: T | null | undefined, message = "Recurso no encontrado.") {
  if (!value) {
    throw new ServiceError("RESOURCE_NOT_FOUND", 404, message);
  }

  return value;
}
