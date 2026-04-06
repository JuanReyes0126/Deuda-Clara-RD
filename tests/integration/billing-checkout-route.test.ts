import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/billing/checkout/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/recent-auth", () => ({
  assertRecentAuth: vi.fn(),
}));

vi.mock("@/server/billing/billing-service", () => ({
  createMembershipCheckoutSession: vi.fn(),
}));

describe("api/billing/checkout", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza checkout si no hay sesion", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const response = await POST(
      buildJsonRequest("http://localhost/api/billing/checkout", {
          membershipTier: "NORMAL",
          sourceContext: "planes",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autenticado.");
  });

  it("crea checkout valido para premium", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { createMembershipCheckoutSession } = await import(
      "@/server/billing/billing-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(createMembershipCheckoutSession).mockResolvedValueOnce({
      url: "https://checkout.stripe.com/test-session",
    } as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/billing/checkout", {
          membershipTier: "NORMAL",
          sourceContext: "dashboard",
      }),
    );
    const body = (await response.json()) as { url: string };

    expect(response.status).toBe(200);
    expect(body.url).toContain("checkout.stripe.com");
    expect(createMembershipCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "NORMAL",
      expect.any(Object),
      "dashboard",
    );
  });

  it("pide reautenticacion si la sesion ya no es fresca", async () => {
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
      buildJsonRequest("http://localhost/api/billing/checkout", {
        membershipTier: "NORMAL",
        sourceContext: "dashboard",
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
});
