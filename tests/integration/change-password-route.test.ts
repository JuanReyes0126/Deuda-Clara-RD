import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/cambiar-contrasena/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/recent-auth", () => ({
  assertRecentAuth: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "change-password-key"),
}));

vi.mock("@/server/auth/auth-service", () => ({
  changePassword: vi.fn(),
}));

describe("api/auth/cambiar-contrasena", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cambia la contraseña cuando la sesion es reciente", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { changePassword } = await import("@/server/auth/auth-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(changePassword).mockResolvedValueOnce(undefined as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/cambiar-contrasena", {
        currentPassword: "DeudaClara123!",
        newPassword: "Segura123A",
        confirmPassword: "Segura123A",
      }),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(changePassword).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        currentPassword: "DeudaClara123!",
        newPassword: "Segura123A",
      }),
      expect.any(Object),
    );
  });

  it("pide reautenticacion reciente antes de cambiar la contraseña", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { ServiceError } = await import("@/server/services/service-error");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockRejectedValueOnce(
      new ServiceError("REAUTH_REQUIRED", 403, "Confirma tu identidad para continuar."),
    );

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/cambiar-contrasena", {
        currentPassword: "DeudaClara123!",
        newPassword: "Segura123A",
        confirmPassword: "Segura123A",
      }),
    );
    const body = (await response.json()) as {
      error: string;
      reauthRequired?: boolean;
    };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Confirma tu identidad para continuar.");
    expect(body.reauthRequired).toBe(true);
  });

  it("rechaza el cambio cuando no hay sesión activa", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(getCurrentSession).mockResolvedValueOnce(null as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/cambiar-contrasena", {
        currentPassword: "DeudaClara123!",
        newPassword: "Segura123A",
        confirmPassword: "Segura123A",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autenticado.");
  });
});
