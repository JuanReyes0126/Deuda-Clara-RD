import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as registerPost } from "@/app/api/auth/registrar/route";

vi.mock("@/lib/auth/session", () => ({
  createUserSession: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
}));

vi.mock("@/server/auth/auth-service", () => ({
  authenticateUser: vi.fn(),
  registerUser: vi.fn(),
}));

vi.mock("@/server/services/database-availability", () => ({
  isDatabaseReachable: vi.fn(),
  markDatabaseUnavailable: vi.fn(),
}));

vi.mock("@/lib/demo/auth", () => ({
  authenticateDemoUser: vi.fn(),
  getDemoAuthHint: vi.fn(() => "Modo demo activo."),
  registerDemoUser: vi.fn(),
}));

vi.mock("@/lib/demo/session", () => ({
  createDemoSession: vi.fn(),
  isDemoModeEnabled: vi.fn(() => true),
}));

vi.mock("@/server/auth/tokens", () => ({
  generateOpaqueToken: vi.fn(() => "opaque-token"),
}));

describe("api/auth demo fallback", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("login usa demo sin tocar auth real cuando la base no esta disponible", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { authenticateUser } = await import("@/server/auth/auth-service");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");
    const { authenticateDemoUser } = await import("@/lib/demo/auth");
    const { createDemoSession } = await import("@/lib/demo/session");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(false);
    vi.mocked(authenticateDemoUser).mockResolvedValueOnce({
      firstName: "Cuenta",
      lastName: "demo",
      email: "demo@deudaclarard.com",
    });

    const response = await loginPost(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          host: "localhost",
        },
        body: JSON.stringify({
          email: "demo@deudaclarard.com",
          password: "DeudaClara123!",
        }),
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      redirectTo: string;
      demoMode: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.demoMode).toBe(true);
    expect(body.redirectTo).toBe("/dashboard");
    expect(createDemoSession).toHaveBeenCalled();
    expect(authenticateUser).not.toHaveBeenCalled();
  });

  it("registro usa cuenta demo local sin tocar Prisma cuando la base no esta disponible", async () => {
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { registerUser } = await import("@/server/auth/auth-service");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");
    const { registerDemoUser } = await import("@/lib/demo/auth");
    const { createDemoSession } = await import("@/lib/demo/session");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(false);
    vi.mocked(registerDemoUser).mockResolvedValueOnce({
      firstName: "Ana",
      lastName: "Perez",
      email: "ana@correo.com",
    });

    const response = await registerPost(
      new NextRequest("http://localhost/api/auth/registrar", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          host: "localhost",
        },
        body: JSON.stringify({
          firstName: "Ana",
          lastName: "Perez",
          email: "ana@correo.com",
          password: "DeudaClara123!",
          confirmPassword: "DeudaClara123!",
        }),
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      redirectTo: string;
      demoMode: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.demoMode).toBe(true);
    expect(body.redirectTo).toBe("/dashboard");
    expect(createDemoSession).toHaveBeenCalled();
    expect(registerUser).not.toHaveBeenCalled();
  });
});
