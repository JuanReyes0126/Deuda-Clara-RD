import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as forgotPasswordPost } from "@/app/api/auth/recuperar-contrasena/route";
import { ServiceError } from "@/server/services/service-error";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/server/auth/auth-service", () => ({
  requestPasswordReset: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "forgot-password-key"),
}));

describe("api/auth recovery", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("solicita recuperación con respuesta uniforme", async () => {
    const { requestPasswordReset } = await import("@/server/auth/auth-service");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(requestPasswordReset).mockResolvedValueOnce(undefined);

    const response = await forgotPasswordPost(
      buildJsonRequest("http://localhost/api/auth/recuperar-contrasena", {
        email: "usuario@deudaclarard.com",
      }),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("propaga errores de servicio de forma controlada", async () => {
    const { requestPasswordReset } = await import("@/server/auth/auth-service");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(requestPasswordReset).mockRejectedValueOnce(
      new ServiceError(
        "RESET_BLOCKED",
        429,
        "Debes esperar antes de volver a solicitar el correo.",
      ),
    );

    const response = await forgotPasswordPost(
      buildJsonRequest("http://localhost/api/auth/recuperar-contrasena", {
        email: "usuario@deudaclarard.com",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe("Debes esperar antes de volver a solicitar el correo.");
  });
});
