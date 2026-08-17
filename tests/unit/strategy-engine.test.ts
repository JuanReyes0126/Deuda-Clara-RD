import { DebtStatus, DebtType, InterestRateType, StrategyMethod } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { calculateDebtStrategy } from "@/server/planner/strategy-engine";

const sampleDebts = [
  {
    id: "card-1",
    name: "Tarjeta Visa",
    type: DebtType.CREDIT_CARD,
    status: DebtStatus.CURRENT,
    currentBalance: 100000,
    interestRate: 48,
    interestRateType: InterestRateType.ANNUAL,
    minimumPayment: 7000,
    lateFeeAmount: 0,
    extraChargesAmount: 0,
  },
  {
    id: "loan-1",
    name: "Prestamo personal",
    type: DebtType.PERSONAL_LOAN,
    status: DebtStatus.CURRENT,
    currentBalance: 80000,
    interestRate: 18,
    interestRateType: InterestRateType.ANNUAL,
    minimumPayment: 5000,
    lateFeeAmount: 0,
    extraChargesAmount: 0,
  },
];

describe("strategy-engine", () => {
  it("reduce intereses y tiempo frente al pago minimo", () => {
    const result = calculateDebtStrategy(sampleDebts, {
      strategy: StrategyMethod.AVALANCHE,
      monthlyBudget: 18000,
    });

    expect(result.recommendedOrder[0]?.id).toBe("card-1");
    expect(result.selectedPlan.feasible).toBe(true);
    expect(result.currentPlan.feasible).toBe(true);
    expect(result.selectedPlan.totalInterest).toBeLessThan(result.currentPlan.totalInterest);
    expect(result.selectedPlan.monthsToPayoff).toBeLessThan(
      result.currentPlan.monthsToPayoff ?? Number.POSITIVE_INFINITY,
    );
  });

  it("snowball prioriza el saldo mas pequeno", () => {
    const result = calculateDebtStrategy(sampleDebts, {
      strategy: StrategyMethod.SNOWBALL,
      monthlyBudget: 18000,
    });

    expect(result.recommendedOrder[0]?.id).toBe("loan-1");
  });

  it("detecta planes no amortizables", () => {
    const result = calculateDebtStrategy(
      [
        {
          id: "bad-card",
          name: "Tarjeta al minimo",
          type: DebtType.CREDIT_CARD,
          status: DebtStatus.CURRENT,
          currentBalance: 10000,
          interestRate: 60,
          interestRateType: InterestRateType.ANNUAL,
          minimumPayment: 100,
          lateFeeAmount: 0,
          extraChargesAmount: 0,
        },
      ],
      {
        strategy: StrategyMethod.AVALANCHE,
        monthlyBudget: 100,
      },
    );

    expect(result.selectedPlan.feasible).toBe(false);
    expect(result.selectedPlan.reason).toBe("non_amortizing");
  });
});
