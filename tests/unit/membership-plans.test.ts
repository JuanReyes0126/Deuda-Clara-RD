import { describe, expect, it } from "vitest";

import { getMembershipPlan, hasMembershipAccess } from "@/lib/membership/plans";

describe("membership-plans", () => {
  it("devuelve el plan base cuando no hay tier", () => {
    expect(getMembershipPlan(undefined).id).toBe("FREE");
  });

  it("resuelve correctamente el plan pro", () => {
    const plan = getMembershipPlan("PRO");

    expect(plan.id).toBe("PRO");
    expect(plan.monthlyPriceUsd).toBe(10);
    expect(plan.durationMonths).toBe(12);
    expect(plan.recommendationUnlocked).toBe(true);
  });

  it("mantiene premium como el plan rápido de 6 meses", () => {
    const plan = getMembershipPlan("NORMAL");

    expect(plan.label).toBe("Premium");
    expect(plan.durationMonths).toBe(6);
  });

  it("solo desbloquea la capa premium cuando la facturación está activa", () => {
    expect(hasMembershipAccess("NORMAL", "ACTIVE")).toBe(true);
    expect(hasMembershipAccess("NORMAL", "PAST_DUE")).toBe(false);
    expect(hasMembershipAccess("FREE", "ACTIVE")).toBe(false);
  });
});
