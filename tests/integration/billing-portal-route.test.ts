import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/billing/portal/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/recent-auth", () => ({
  assertRecentAuth: vi.fn(),
}));

vi.mock("@/server/billing/billing-service", () => ({
  createBillingPortalSession: vi.fn(),
}));

describe("api/billing/portal", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza portal si no hay sesion", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    vi.mocked(getCurrentSession).mockResolvedValueOnce(null);

    const response = await POST(
      buildJsonRequest("http://localhost/api/billing/portal", {}),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autenticado.");
  });

  it("abre portal de billing con sesion reciente", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { assertRecentAuth } = await import("@/lib/security/recent-auth");
    const { createBillingPortalSession } = await import(
      "@/server/billing/billing-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(assertRecentAuth).mockResolvedValueOnce(undefined as never);
    vi.mocked(createBillingPortalSession).mockResolvedValueOnce({
      url: "https://billing.azul.test/manage",
    } as never);

    const response = await POST(
      buildJsonRequest("http://localhost/api/billing/portal", {}),
    );
    const body = (await response.json()) as { url: string };

    expect(response.status).toBe(200);
    expect(body.url).toContain("billing.azul");
    expect(createBillingPortalSession).toHaveBeenCalledWith(
      "user-1",
      expect.any(Object),
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
      buildJsonRequest("http://localhost/api/billing/portal", {}),
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
