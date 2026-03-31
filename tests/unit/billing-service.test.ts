import { describe, expect, it } from "vitest";

import {
  mapStripeSubscriptionStatus,
  resolveMembershipTierFromPriceId,
} from "@/server/billing/billing-service";

describe("billing-service", () => {
  it("mapea estados activos de Stripe a membresía activa", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("ACTIVE");
  });

  it("mapea estados morosos e inactivos correctamente", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELED");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("INACTIVE");
  });

  it("relaciona precios de Stripe con Premium y Pro", () => {
    const priceMap = {
      NORMAL: "price_premium",
      PRO: "price_pro",
    };

    expect(resolveMembershipTierFromPriceId("price_premium", priceMap)).toBe("NORMAL");
    expect(resolveMembershipTierFromPriceId("price_pro", priceMap)).toBe("PRO");
  });
});
