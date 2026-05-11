import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/restablecer-contrasena/route";
import { ServiceError } from "@/server/services/service-error";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "reset-password-key"),
}));

vi.mock("@/server/auth/auth-service", () => ({
  resetPassword: vi.fn(),
}));

describe("api/auth/restablecer-contrasena", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("restablece la contraseña cuando el token y el payload son validos", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { resetPassword } = await import("@/server/auth/auth-service");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(resetPassword).mockResolvedValueOnce(undefined as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/restablecer-contrasena", {
        token: "token-valido-lo-suficiente-123",
        password: "DeudaClara123!",
        confirmPassword: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token-valido-lo-suficiente-123",
        password: "DeudaClara123!",
      }),
      expect.any(Object),
    );
  });

  it("devuelve el error de servicio cuando el enlace ya no es valido", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { resetPassword } = await import("@/server/auth/auth-service");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(resetPassword).mockRejectedValueOnce(
      new ServiceError("RESET_TOKEN_INVALID", 400, "El enlace ya no es válido."),
    );

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/restablecer-contrasena", {
        token: "token-expirado-lo-suficiente-456",
        password: "DeudaClara123!",
        confirmPassword: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("El enlace ya no es válido.");
  });
});
