import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/registrar/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  createUserSession: vi.fn(),
}));

vi.mock("@/server/auth/auth-service", () => ({
  authenticateUser: vi.fn(),
  registerUser: vi.fn(),
}));

vi.mock("@/server/services/database-availability", () => ({
  isDatabaseReachable: vi.fn(),
  markDatabaseUnavailable: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "auth-rate-limit-key"),
}));

vi.mock("@/lib/demo/auth", () => ({
  authenticateDemoUser: vi.fn(),
  getDemoAuthHint: vi.fn(() => "Modo demo activo."),
  registerDemoUser: vi.fn(),
}));

vi.mock("@/lib/demo/session", () => ({
  createDemoSession: vi.fn(),
  isDemoModeEnabled: vi.fn(() => false),
}));

vi.mock("@/server/auth/tokens", () => ({
  generateOpaqueToken: vi.fn(() => "opaque-token"),
}));

describe("api/auth", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("inicia sesion con credenciales validas", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { authenticateUser } = await import("@/server/auth/auth-service");
    const { createUserSession } = await import("@/lib/auth/session");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(true);
    vi.mocked(authenticateUser).mockResolvedValueOnce({
      id: "user-1",
      onboardingCompleted: true,
    } as never);

    const response = await loginPost(
      buildJsonRequest("http://localhost/api/auth/login", {
          email: "demo@deudaclarard.com",
          password: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as { ok: boolean; redirectTo: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/dashboard");
    expect(createUserSession).toHaveBeenCalledWith("user-1", "opaque-token");
  });

  it("marca mfaRequired cuando la cuenta necesita segundo factor", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { authenticateUser } = await import("@/server/auth/auth-service");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");
    const { ServiceError } = await import("@/server/services/service-error");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(true);
    vi.mocked(authenticateUser).mockRejectedValueOnce(
      new ServiceError("MFA_REQUIRED", 401, "Ingresa tu código de verificación."),
    );

    const response = await loginPost(
      buildJsonRequest("http://localhost/api/auth/login", {
        email: "demo@deudaclarard.com",
        password: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as {
      error: string;
      mfaRequired?: boolean;
    };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Ingresa tu código de verificación.");
    expect(body.mfaRequired).toBe(true);
  });

  it("registra una cuenta valida", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { registerUser } = await import("@/server/auth/auth-service");
    const { createUserSession } = await import("@/lib/auth/session");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(true);
    vi.mocked(registerUser).mockResolvedValueOnce({
      id: "user-2",
    } as never);

    const response = await registerPost(
      buildJsonRequest("http://localhost/api/auth/registrar", {
          firstName: "Ana",
          lastName: "Perez",
          email: "ana@correo.com",
          password: "DeudaClara123!",
          confirmPassword: "DeudaClara123!",
          acceptLegal: true,
      }),
    );
    const body = (await response.json()) as { ok: boolean; redirectTo: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/onboarding");
    expect(createUserSession).toHaveBeenCalledWith("user-2", "opaque-token");
  });

  it("rechaza el registro si falta la aceptación legal", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { registerUser } = await import("@/server/auth/auth-service");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(true);

    const response = await registerPost(
      buildJsonRequest("http://localhost/api/auth/registrar", {
        firstName: "Ana",
        lastName: "Perez",
        email: "ana@correo.com",
        password: "DeudaClara123!",
        confirmPassword: "DeudaClara123!",
        acceptLegal: false,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      "Debes aceptar los Términos y Condiciones y la Política de Privacidad.",
    );
    expect(registerUser).not.toHaveBeenCalled();
  });
});
