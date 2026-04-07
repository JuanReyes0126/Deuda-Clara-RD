import { describe, expect, it } from "vitest";

import { checkoutPlanSchema } from "@/lib/validations/billing";

describe("billing validation", () => {
  it("acepta reportes y notificaciones como sourceContext válido", () => {
    expect(
      checkoutPlanSchema.safeParse({
        membershipTier: "NORMAL",
        billingInterval: "monthly",
        sourceContext: "reportes",
      }).success,
    ).toBe(true);

    expect(
      checkoutPlanSchema.safeParse({
        membershipTier: "PRO",
        billingInterval: "annual",
        sourceContext: "notificaciones",
      }).success,
    ).toBe(true);
  });

  it("usa billing mensual por defecto si no se especifica intervalo", () => {
    const parsed = checkoutPlanSchema.safeParse({
      membershipTier: "NORMAL",
      sourceContext: "planes",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.billingInterval : null).toBe("monthly");
  });

  it("rechaza contextos no permitidos", () => {
    expect(
      checkoutPlanSchema.safeParse({
        membershipTier: "NORMAL",
        sourceContext: "landing",
      }).success,
    ).toBe(false);
  });
});
