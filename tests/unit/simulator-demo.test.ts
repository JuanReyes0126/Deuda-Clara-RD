import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_USER_ID } from "@/lib/demo/session";

const cookieState = new Map<string, string>();
const cookieStore = {
  get: vi.fn((name: string) => {
    const value = cookieState.get(name);
    return value ? { value } : undefined;
  }),
  set: vi.fn((name: string, value: string) => {
    cookieState.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    cookieState.delete(name);
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const simulatorInput = {
  strategy: "AVALANCHE" as const,
  monthlyBudget: 22000,
  extraMonthlyPayment: 2000,
  focusedDebtId: "demo-card-1",
  cardToFreezeId: "demo-card-1",
  monthlyCardUsageToStop: 5000,
  refinanceDebtId: "demo-card-1",
  refinancedRate: 35,
  refinancedMinimumPayment: undefined,
};

describe("simulator demo fallback", () => {
  beforeEach(() => {
    cookieState.clear();
    cookieStore.get.mockClear();
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
  });

  it("usa las deudas demo actualizadas despues de registrar pagos", async () => {
    const { runSimulator } = await import("@/server/simulator/simulator-service");
    const { createDemoPayment } = await import("@/lib/demo/payments");

    const baseline = await runSimulator(DEMO_USER_ID, simulatorInput);

    await createDemoPayment({
      debtId: "demo-card-1",
      amount: 20000,
      paidAt: new Date("2026-03-29T12:00:00.000Z"),
      source: "MANUAL",
    });

    const updated = await runSimulator(DEMO_USER_ID, simulatorInput);

    expect(updated.basePlan.totalPaid).toBeLessThan(baseline.basePlan.totalPaid);
    expect(updated.basePlan.totalInterest).toBeLessThan(baseline.basePlan.totalInterest);
    expect(updated.basePlan.monthsToPayoff).not.toBeNull();
    expect(updated.basePlan.monthsToPayoff).toBeLessThanOrEqual(
      baseline.basePlan.monthsToPayoff ?? Number.MAX_SAFE_INTEGER,
    );
  }, 120000);

  it("arma el snapshot de conversion con el estado demo real", async () => {
    const { createDemoPayment } = await import("@/lib/demo/payments");
    const { listDemoDebts } = await import("@/lib/demo/debts");
    const { buildMembershipConversionSnapshot } = await import(
      "@/server/dashboard/dashboard-service"
    );

    const baselineSnapshot = buildMembershipConversionSnapshot({
      debts: await listDemoDebts(false),
      preferredStrategy: "AVALANCHE",
      monthlyDebtBudget: 22000,
      hybridRateWeight: 70,
      hybridBalanceWeight: 30,
    });

    await createDemoPayment({
      debtId: "demo-loan-1",
      amount: 15000,
      paidAt: new Date("2026-03-30T12:00:00.000Z"),
      source: "MANUAL",
    });

    const updatedSnapshot = buildMembershipConversionSnapshot({
      debts: await listDemoDebts(false),
      preferredStrategy: "AVALANCHE",
      monthlyDebtBudget: 22000,
      hybridRateWeight: 70,
      hybridBalanceWeight: 30,
    });

    expect(updatedSnapshot.hasDebts).toBe(true);
    expect(updatedSnapshot.totalDebt).toBeLessThan(baselineSnapshot.totalDebt);
    expect(updatedSnapshot.estimatedMonthlyInterest).toBeLessThan(
      baselineSnapshot.estimatedMonthlyInterest,
    );
  }, 120000);
});
