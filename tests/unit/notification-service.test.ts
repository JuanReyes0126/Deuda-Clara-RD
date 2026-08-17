import { describe, expect, it } from "vitest";

import { buildPremiumWeeklyFollowUp } from "@/server/notifications/notification-service";

describe("notification-service premium follow-up", () => {
  it("marca seguimiento de warning cuando el usuario retrocede", () => {
    const result = buildPremiumWeeklyFollowUp({
      signal: "REGRESSION",
      recommendedDebtName: "Tarjeta Visa principal",
      selectedMonthlyBudget: 25000,
      defaultCurrency: "DOP",
      monthsToPayoff: 12,
    });

    expect(result.severity).toBe("WARNING");
    expect(result.title).toContain("perdió tracción");
    expect(result.message).toContain("Tarjeta Visa principal");
  });

  it("mantiene tono positivo cuando el usuario mejora", () => {
    const result = buildPremiumWeeklyFollowUp({
      signal: "IMPROVING",
      recommendedDebtName: "Préstamo personal",
      selectedMonthlyBudget: 18000,
      defaultCurrency: "DOP",
      monthsToPayoff: 8,
    });

    expect(result.severity).toBe("INFO");
    expect(result.title).toContain("Buen avance");
    expect(result.message).toContain("8 meses");
  });
});
