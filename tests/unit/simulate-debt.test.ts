import { describe, expect, it } from "vitest";

import { simulateDebt } from "@/lib/simulator/simulate-debt";

describe("simulateDebt", () => {
  it("reduce tiempo e intereses cuando se agrega un pago extra", () => {
    const result = simulateDebt({
      debtType: "PERSONAL_LOAN",
      principal: 100000,
      interestRate: 24,
      interestRateType: "ANNUAL",
      paymentAmount: 5000,
      extraPayment: 1500,
      startDate: new Date("2026-03-30T00:00:00.000Z"),
      paymentFrequency: "MONTHLY",
    });

    expect(result.scenarios.base.feasible).toBe(true);
    expect(result.scenarios.extra.feasible).toBe(true);
    expect(result.savingsWithExtraPayment.interestSaved).toBeGreaterThan(0);
    expect(result.savingsWithExtraPayment.monthsSaved).not.toBeNull();
    expect((result.savingsWithExtraPayment.monthsSaved ?? 0) > 0).toBe(true);
    expect(result.scenarios.extra.totalInterest).toBeLessThan(
      result.scenarios.base.totalInterest,
    );
  });

  it("detecta cuando el pago no cubre ni siquiera el interes", () => {
    const result = simulateDebt({
      debtType: "CREDIT_CARD",
      principal: 50000,
      interestRate: 8,
      interestRateType: "MONTHLY",
      paymentAmount: 1000,
      extraPayment: 0,
      startDate: new Date("2026-03-30T00:00:00.000Z"),
      paymentFrequency: "MONTHLY",
    });

    expect(result.scenarios.base.feasible).toBe(false);
    expect(result.scenarios.base.monthsToPayoff).toBeNull();
    expect(result.warnings[0]).toContain("no cubres ni el interés");
  });

  it("calcula correctamente una cuota fija sin interes", () => {
    const result = simulateDebt({
      debtType: "FIXED_NO_INTEREST",
      principal: 12000,
      interestRate: 0,
      interestRateType: "ANNUAL",
      paymentAmount: 3000,
      extraPayment: 0,
      startDate: new Date("2026-03-30T00:00:00.000Z"),
      paymentFrequency: "MONTHLY",
    });

    expect(result.totalInterest).toBe(0);
    expect(result.monthsToPayoff).toBe(4);
    expect(result.scenarios.base.totalPaid).toBe(12000);
  });

  it("mantiene calculos finitos con pagos quincenales", () => {
    const result = simulateDebt({
      debtType: "PERSONAL_LOAN",
      principal: 75000,
      interestRate: 18,
      interestRateType: "ANNUAL",
      paymentAmount: 2500,
      extraPayment: 500,
      startDate: new Date("2026-03-30T00:00:00.000Z"),
      paymentFrequency: "BIWEEKLY",
    });

    expect(Number.isFinite(result.totalPaid)).toBe(true);
    expect(Number.isFinite(result.totalInterest)).toBe(true);
    expect(result.scenarios.base.amortizationSchedule.length).toBeGreaterThan(0);
  });

  it("recorta comparacion y ahorro cuando el acceso es Base", () => {
    const result = simulateDebt(
      {
        debtType: "PERSONAL_LOAN",
        principal: 90000,
        interestRate: 22,
        interestRateType: "ANNUAL",
        paymentAmount: 5000,
        extraPayment: 1500,
        startDate: new Date("2026-03-30T00:00:00.000Z"),
        paymentFrequency: "MONTHLY",
      },
      {
        access: {
          canCompareScenarios: false,
          canSeeOptimizedSavings: false,
          canSeeRecommendedStrategy: false,
          canUseAdvancedExtraPayments: false,
          canUseAutoStrategy: false,
          canSeeStepByStepPlan: false,
        },
      },
    );

    expect(result.scenarios.aggressive).toBeNull();
    expect(result.savingsWithExtraPayment.interestSaved).toBe(0);
    expect(result.recommendedScenarioId).toBeNull();
    expect(result.proGuidance.stepByStepPlan).toEqual([]);
  });

  it("expone guía adicional cuando el acceso es Pro", () => {
    const result = simulateDebt(
      {
        debtType: "PERSONAL_LOAN",
        principal: 90000,
        interestRate: 22,
        interestRateType: "ANNUAL",
        paymentAmount: 5000,
        extraPayment: 1500,
        startDate: new Date("2026-03-30T00:00:00.000Z"),
        paymentFrequency: "MONTHLY",
      },
      {
        access: {
          canCompareScenarios: true,
          canSeeOptimizedSavings: true,
          canSeeRecommendedStrategy: true,
          canUseAdvancedExtraPayments: true,
          canUseAutoStrategy: true,
          canSeeStepByStepPlan: true,
        },
      },
    );

    expect(result.recommendedScenarioId).not.toBeNull();
    expect(result.recommendedStrategyLabel).not.toBeNull();
    expect(result.proGuidance.stepByStepPlan.length).toBeGreaterThan(0);
  });
});
