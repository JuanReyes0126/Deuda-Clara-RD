import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/reautenticar/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/recent-auth", () => ({
  refreshRecentAuth: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "reauth-key"),
}));

vi.mock("@/server/auth/auth-service", () => ({
  reauthenticateUser: vi.fn(),
}));

describe("api/auth/reautenticar", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza reautenticacion si no hay sesion", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");

    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/reautenticar", {
        currentPassword: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autenticado.");
  });

  it("refresca recent auth cuando la identidad se confirma", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { refreshRecentAuth } = await import("@/lib/security/recent-auth");
    const { reauthenticateUser } = await import("@/server/auth/auth-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(reauthenticateUser).mockResolvedValueOnce(undefined as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/reautenticar", {
        currentPassword: "DeudaClara123!",
        totpCode: "123456",
      }),
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(refreshRecentAuth).toHaveBeenCalledWith("user-1");
  });

  it("responde 429 si la reautenticacion supera el rate limit", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { refreshRecentAuth } = await import("@/lib/security/recent-auth");
    const { reauthenticateUser } = await import("@/server/auth/auth-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({
      success: false,
      resetAt: Date.now() + 60_000,
    } as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/auth/reautenticar", {
        currentPassword: "DeudaClara123!",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe("Demasiados intentos. Intenta de nuevo más tarde.");
    expect(reauthenticateUser).not.toHaveBeenCalled();
    expect(refreshRecentAuth).not.toHaveBeenCalled();
  });
});
