import { afterEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/settings/membership/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/billing/billing-service", () => ({
  isBillingConfigured: vi.fn(),
}));

vi.mock("@/server/settings/settings-service", () => ({
  updateUserMembershipPlan: vi.fn(),
}));

describe("api/settings/membership", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("bloquea upgrades manuales a planes pagos", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { isBillingConfigured } = await import("@/server/billing/billing-service");
    const { updateUserMembershipPlan } = await import(
      "@/server/settings/settings-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(isBillingConfigured).mockReturnValueOnce(false);

    const response = await PATCH(
      buildJsonRequest(
        "http://localhost/api/settings/membership",
        { membershipTier: "PRO" },
        { method: "PATCH" },
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe("Los planes pagos solo se activan por checkout seguro.");
    expect(updateUserMembershipPlan).not.toHaveBeenCalled();
  });

  it("permite degradar a FREE cuando billing no esta configurado", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { isBillingConfigured } = await import("@/server/billing/billing-service");
    const { updateUserMembershipPlan } = await import(
      "@/server/settings/settings-service"
    );

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(isBillingConfigured).mockReturnValueOnce(false);
    vi.mocked(updateUserMembershipPlan).mockResolvedValueOnce({
      membershipTier: "FREE",
      membershipBillingStatus: "FREE",
      membershipCurrentPeriodEnd: null,
      membershipCancelAtPeriodEnd: false,
    } as never);

    const response = await PATCH(
      buildJsonRequest(
        "http://localhost/api/settings/membership",
        { membershipTier: "FREE" },
        { method: "PATCH" },
      ),
    );
    const body = (await response.json()) as {
      ok: boolean;
      membership: { membershipTier: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.membership.membershipTier).toBe("FREE");
    expect(updateUserMembershipPlan).toHaveBeenCalledWith(
      "user-1",
      { membershipTier: "FREE" },
      { ipAddress: undefined, userAgent: undefined },
    );
  });
});
