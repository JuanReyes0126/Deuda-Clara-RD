import { DebtStatus, DebtType, InterestRateType, StrategyMethod } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildDashboardPlanComparison } from "@/server/dashboard/plan-optimization";

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

describe("plan-optimization", () => {
  it("encuentra una estrategia mejor que la actual cuando existe", () => {
    const result = buildDashboardPlanComparison({
      debts: sampleDebts,
      currentStrategy: StrategyMethod.SNOWBALL,
      monthlyBudget: 18000,
      hybridRateWeight: 70,
      hybridBalanceWeight: 30,
    });

    expect(result.comparison.optimizedPlan.strategy).toBe("AVALANCHE");
    expect(result.comparison.interestSavings).toBeGreaterThan(0);
  });

  it("sugiere un extra cuando el usuario esta practicamente a minimos", () => {
    const result = buildDashboardPlanComparison({
      debts: sampleDebts,
      currentStrategy: StrategyMethod.AVALANCHE,
      monthlyBudget: 12000,
      hybridRateWeight: 70,
      hybridBalanceWeight: 30,
    });

    expect(result.comparison.assumption).not.toBeNull();
    expect(result.comparison.inferredExtraPayment).toBeGreaterThan(0);
  });
});
