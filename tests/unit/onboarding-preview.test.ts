import { describe, expect, it } from "vitest";

import { buildOnboardingPreview } from "@/server/onboarding/onboarding-service";

describe("buildOnboardingPreview", () => {
  it("calcula una recomendación inicial usando el planner del servidor", () => {
    const result = buildOnboardingPreview({
      monthlyIncome: 42_000,
      monthlyDebtBudget: 18_000,
      debts: [
        {
          name: "Tarjeta Gold",
          presetType: "CREDIT_CARD",
          currentBalance: 95_000,
          minimumPayment: 6_500,
          interestRate: 54,
        },
        {
          name: "Préstamo personal",
          presetType: "PERSONAL_LOAN",
          currentBalance: 180_000,
          minimumPayment: 8_200,
          interestRate: 27,
        },
      ],
    });

    expect(result.recommendedStrategy).toBeDefined();
    expect(result.recommendedStrategyLabel.length).toBeGreaterThan(0);
    expect(result.priorityDebtName).toBeTruthy();
    expect(result.immediateAction).toContain("Ataca primero");
    expect(result.monthsToDebtFree === null || result.monthsToDebtFree > 0).toBe(true);
    expect(result.potentialSavings).toBeGreaterThanOrEqual(0);
  });
});
