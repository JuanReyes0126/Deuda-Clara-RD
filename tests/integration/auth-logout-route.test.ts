import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { ServiceError } from "@/server/services/service-error";

vi.mock("@/lib/auth/session", () => ({
  destroyCurrentSession: vi.fn(),
}));

function buildLogoutRequest(url = "http://localhost/api/auth/logout") {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      cookie: "dc_csrf=test-csrf-token",
      host: "localhost",
      origin: "http://localhost",
      "x-csrf-token": "test-csrf-token",
    },
    body: "{}",
  });
}

describe("api/auth/logout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cierra sesión con respuesta JSON simple", async () => {
    const { destroyCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(destroyCurrentSession).mockResolvedValueOnce(undefined);

    const response = await logoutPost(buildLogoutRequest());
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("propaga errores de servicio de forma controlada", async () => {
    const { destroyCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(destroyCurrentSession).mockRejectedValueOnce(
      new ServiceError("SESSION_BLOCKED", 503, "No se pudo cerrar la sesión."),
    );

    const response = await logoutPost(buildLogoutRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe("No se pudo cerrar la sesión.");
  });

  it("redirige cuando se pide una ruta interna", async () => {
    const { destroyCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(destroyCurrentSession).mockResolvedValueOnce(undefined);

    const response = await logoutPost(
      buildLogoutRequest("http://localhost/api/auth/logout?redirectTo=/login"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });
});
