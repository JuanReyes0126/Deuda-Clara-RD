import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveFeatureAccess } from "@/lib/feature-access";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
    },
  },
  runWithPrismaReconnect: vi.fn(async <T>(operation: () => Promise<T> | T) => operation()),
  isPrismaClosedConnectionError: vi.fn(() => false),
}));

vi.mock("@/lib/demo/session", () => ({
  isDemoSessionUser: vi.fn(() => false),
}));

vi.mock("@/server/membership/membership-access-service", () => ({
  getUserFeatureAccess: vi.fn(),
}));

describe("simulator-service membership access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("filtra la salida avanzada para Base y no devuelve ahorro ni estrategia completa", async () => {
    const { getUserFeatureAccess } = await import(
      "@/server/membership/membership-access-service"
    );
    const { prisma } = await import("@/lib/db/prisma");
    const { runSimulator } = await import("@/server/simulator/simulator-service");

    vi.mocked(getUserFeatureAccess).mockResolvedValueOnce(
      resolveFeatureAccess({
        membershipTier: "NORMAL",
        membershipBillingStatus: "INACTIVE",
      }),
    );
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValueOnce({
      settings: {
        hybridRateWeight: 70,
        hybridBalanceWeight: 30,
      },
      debts: [
        {
          id: "debt-1",
          name: "Tarjeta oro",
          type: "CREDIT_CARD",
          status: "CURRENT",
          currentBalance: 100000,
          interestRate: 48,
          interestRateType: "ANNUAL",
          minimumPayment: 6000,
          lateFeeAmount: 0,
          extraChargesAmount: 0,
          nextDueDate: new Date("2026-04-20T00:00:00.000Z"),
        },
      ],
    } as never);

    const result = await runSimulator("user-1", {
      strategy: "AVALANCHE",
      monthlyBudget: 22000,
    });

    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(result.extraPaymentPlan.monthsToPayoff).toBe(result.basePlan.monthsToPayoff);
    expect(result.extraPaymentPlan.totalInterest).toBe(result.basePlan.totalInterest);
    expect(result.extraPaymentPlan.savings).toBeNull();
    expect(result.focusedDebtPlan.focusedDebtId).toBeNull();
    expect(result.focusedDebtPlan.totalInterest).toBe(result.basePlan.totalInterest);
    expect(result.freezeCardPlan.cardId).toBeNull();
    expect(result.refinancePlan.debtId).toBeNull();
    expect(result.selectedStrategyExplanation).toContain("Premium");
    expect(result.monthlyProjection.length).toBeLessThanOrEqual(6);
  }, 15000);

  it("Premium activo filtra refinanciar aunque lleguen campos en el cuerpo", async () => {
    const { getUserFeatureAccess } = await import(
      "@/server/membership/membership-access-service"
    );
    const { prisma } = await import("@/lib/db/prisma");
    const { runSimulator } = await import("@/server/simulator/simulator-service");

    vi.mocked(getUserFeatureAccess).mockResolvedValueOnce(
      resolveFeatureAccess({
        membershipTier: "NORMAL",
        membershipBillingStatus: "ACTIVE",
      }),
    );
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValueOnce({
      settings: {
        hybridRateWeight: 70,
        hybridBalanceWeight: 30,
      },
      debts: [
        {
          id: "debt-1",
          name: "Tarjeta oro",
          type: "CREDIT_CARD",
          status: "CURRENT",
          currentBalance: 100000,
          interestRate: 48,
          interestRateType: "ANNUAL",
          minimumPayment: 6000,
          lateFeeAmount: 0,
          extraChargesAmount: 0,
          nextDueDate: new Date("2026-04-20T00:00:00.000Z"),
        },
      ],
    } as never);

    const result = await runSimulator("user-1", {
      strategy: "AVALANCHE",
      monthlyBudget: 22000,
      refinanceDebtId: "debt-1",
      refinancedRate: 12,
    });

    expect(result.refinancePlan.debtId).toBeNull();
    expect(result.refinancePlan.newRate).toBeNull();
  }, 15000);

  it("Pro activo devuelve refinanciar cuando el cuerpo lo pide", async () => {
    const { getUserFeatureAccess } = await import(
      "@/server/membership/membership-access-service"
    );
    const { prisma } = await import("@/lib/db/prisma");
    const { runSimulator } = await import("@/server/simulator/simulator-service");

    vi.mocked(getUserFeatureAccess).mockResolvedValueOnce(
      resolveFeatureAccess({
        membershipTier: "PRO",
        membershipBillingStatus: "ACTIVE",
      }),
    );
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValueOnce({
      settings: {
        hybridRateWeight: 70,
        hybridBalanceWeight: 30,
      },
      debts: [
        {
          id: "debt-1",
          name: "Tarjeta oro",
          type: "CREDIT_CARD",
          status: "CURRENT",
          currentBalance: 100000,
          interestRate: 48,
          interestRateType: "ANNUAL",
          minimumPayment: 6000,
          lateFeeAmount: 0,
          extraChargesAmount: 0,
          nextDueDate: new Date("2026-04-20T00:00:00.000Z"),
        },
      ],
    } as never);

    const result = await runSimulator("user-1", {
      strategy: "AVALANCHE",
      monthlyBudget: 22000,
      refinanceDebtId: "debt-1",
      refinancedRate: 12,
    });

    expect(result.refinancePlan.debtId).toBe("debt-1");
    expect(result.refinancePlan.newRate).toBe(12);
  }, 15000);
});
