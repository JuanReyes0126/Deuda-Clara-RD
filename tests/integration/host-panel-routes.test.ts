import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/internal/host-access/route";
import { POST } from "@/app/api/internal/host-gate/route";
import { buildJsonRequest } from "./request-helpers";

const INTERNAL_SECRET = "test-host-access-secret-with-32-chars";

vi.mock("@/server/host/host-access", () => ({
  assertHostPanelApiAccess: vi.fn(),
  setHostPanelGateCookie: vi.fn(),
  verifyHostSecondaryPassword: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "host-rate-limit-key"),
}));

vi.mock("@/lib/security/origin", () => ({
  assertSameOrigin: vi.fn(),
}));

vi.mock("@/server/observability/logger", () => ({
  logServerWarn: vi.fn(),
}));

describe("api/internal/host", () => {
  beforeEach(() => {
    vi.stubEnv("APP_URL", "http://localhost");
    vi.stubEnv("AUTH_SECRET", INTERNAL_SECRET);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("bloquea acceso interno sin sesion", async () => {
    const { assertHostPanelApiAccess } = await import("@/server/host/host-access");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(assertHostPanelApiAccess).mockResolvedValueOnce({
      outcome: "LOGIN",
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/internal/host-access?pathname=%2Fhost", {
        headers: {
          "x-deuda-clara-host-access": INTERNAL_SECRET,
          origin: "http://localhost",
          host: "localhost",
        },
      }),
    );
    const body = (await response.json()) as { ok: boolean; outcome: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.outcome).toBe("LOGIN");
  });

  it("exige clave secundaria cuando aplica", async () => {
    const { assertHostPanelApiAccess } = await import("@/server/host/host-access");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(assertHostPanelApiAccess).mockResolvedValueOnce({
      outcome: "SECONDARY_REQUIRED",
      user: { id: "admin-1" },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/internal/host-access?pathname=%2Fhost", {
        headers: {
          "x-deuda-clara-host-access": INTERNAL_SECRET,
          origin: "http://localhost",
          host: "localhost",
        },
      }),
    );
    const body = (await response.json()) as { ok: boolean; outcome: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.outcome).toBe("SECONDARY_REQUIRED");
  });

  it("exige MFA activo antes de permitir panel interno a admin", async () => {
    const { assertHostPanelApiAccess } = await import("@/server/host/host-access");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(assertHostPanelApiAccess).mockResolvedValueOnce({
      outcome: "MFA_SETUP_REQUIRED",
      user: { id: "admin-1" },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/internal/host-access?pathname=%2Fhost", {
        headers: {
          "x-deuda-clara-host-access": INTERNAL_SECRET,
          origin: "http://localhost",
          host: "localhost",
        },
      }),
    );
    const body = (await response.json()) as { ok: boolean; outcome: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.outcome).toBe("MFA_SETUP_REQUIRED");
  });

  it("permite acceso interno autorizado", async () => {
    const { assertHostPanelApiAccess } = await import("@/server/host/host-access");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(assertHostPanelApiAccess).mockResolvedValueOnce({
      outcome: "GRANTED",
      user: { id: "admin-1" },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/internal/host-access?pathname=%2Fhost", {
        headers: {
          "x-deuda-clara-host-access": INTERNAL_SECRET,
          origin: "http://localhost",
          host: "localhost",
        },
      }),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("rechaza clave secundaria incorrecta", async () => {
    const { assertHostPanelApiAccess, verifyHostSecondaryPassword } = await import(
      "@/server/host/host-access"
    );
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertHostPanelApiAccess).mockResolvedValueOnce({
      outcome: "GRANTED",
      user: { id: "admin-1", email: "admin@deudaclarard.com" },
    } as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(verifyHostSecondaryPassword).mockResolvedValueOnce(false as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/internal/host-gate", {
          password: "incorrecta",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("La clave secundaria no coincide.");
  });

  it("desbloquea el panel cuando la clave es valida", async () => {
    const {
      assertHostPanelApiAccess,
      verifyHostSecondaryPassword,
      setHostPanelGateCookie,
    } = await import("@/server/host/host-access");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");

    vi.mocked(assertHostPanelApiAccess).mockResolvedValueOnce({
      outcome: "GRANTED",
      user: { id: "admin-1", email: "admin@deudaclarard.com" },
    } as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(verifyHostSecondaryPassword).mockResolvedValueOnce(true as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/internal/host-gate", {
          password: "host-pass-123",
      }),
    );
    const body = (await response.json()) as { ok: boolean; redirectTo: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.redirectTo).toBe("/host");
    expect(setHostPanelGateCookie).toHaveBeenCalledOnce();
  });
});
