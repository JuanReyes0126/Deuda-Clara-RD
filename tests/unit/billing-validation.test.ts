import { describe, expect, it } from "vitest";

import { checkoutPlanSchema } from "@/lib/validations/billing";

describe("billing validation", () => {
  it("acepta reportes y notificaciones como sourceContext válido", () => {
    expect(
      checkoutPlanSchema.safeParse({
        membershipTier: "NORMAL",
        sourceContext: "reportes",
      }).success,
    ).toBe(true);

    expect(
      checkoutPlanSchema.safeParse({
        membershipTier: "PRO",
        sourceContext: "notificaciones",
      }).success,
    ).toBe(true);
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
