import { addMonths } from "date-fns";
import {
  AuditAction,
  BalanceSnapshotSource,
  CurrencyCode,
  DebtStatus,
  DebtType,
  InterestRateType,
  StrategyMethod,
} from "@prisma/client";

import {
  ONBOARDING_DEBT_PRESETS,
} from "@/config/onboarding";
import { prisma } from "@/lib/db/prisma";
import { buildMonthlyCashflowSnapshot } from "@/lib/finance/monthly-cashflow";
import type { OnboardingPreviewDto } from "@/lib/types/app";
import type { OnboardingInput } from "@/lib/validations/settings";
import { createAuditLog } from "@/server/audit/audit-service";
import { buildDashboardPlanComparison } from "@/server/dashboard/plan-optimization";
import { ServiceError } from "@/server/services/service-error";
import { captureBalanceSnapshot } from "@/server/snapshots/balance-snapshot-service";

type ResolvedOnboardingDebt = {
  name: string;
  type: DebtType;
  creditorName: string;
  currentBalance: number;
  minimumPayment: number;
  interestRate: number;
};

function getStrategyLabel(strategy: StrategyMethod) {
  if (strategy === StrategyMethod.AVALANCHE) {
    return "Avalancha";
  }

  if (strategy === StrategyMethod.SNOWBALL) {
    return "Bola de nieve";
  }

  return "Híbrido";
}

function toProjectedDate(monthsToPayoff: number | null) {
  return monthsToPayoff === null
    ? null
    : addMonths(new Date(), monthsToPayoff).toISOString();
}

function resolveOnboardingDebts(input: OnboardingInput): ResolvedOnboardingDebt[] {
  return input.debts.map((debt) => {
    const preset = ONBOARDING_DEBT_PRESETS[debt.presetType];

    return {
      name: debt.name,
      type: debt.presetType as DebtType,
      creditorName: preset.creditorName,
      currentBalance: debt.currentBalance,
      minimumPayment: debt.minimumPayment,
      interestRate: debt.interestRate ?? preset.annualRate,
    };
  });
}

function buildPreviewStrategyDebts(input: OnboardingInput) {
  return resolveOnboardingDebts(input).map((debt, index) => ({
    id: `preview-debt-${index + 1}`,
    name: debt.name,
    type: debt.type,
    status: DebtStatus.CURRENT,
    currentBalance: debt.currentBalance,
    interestRate: debt.interestRate,
    interestRateType: InterestRateType.ANNUAL,
    minimumPayment: debt.minimumPayment,
    lateFeeAmount: 0,
    extraChargesAmount: 0,
  }));
}

export function buildOnboardingPreview(input: OnboardingInput): OnboardingPreviewDto {
  const strategyDebts = buildPreviewStrategyDebts(input);
  const cashflow = buildMonthlyCashflowSnapshot(input);
  const { comparison, optimizedResult } = buildDashboardPlanComparison({
    debts: strategyDebts,
    currentStrategy: StrategyMethod.AVALANCHE,
    monthlyBudget: input.monthlyDebtBudget,
  });
  const priorityDebt = optimizedResult.recommendedOrder[0] ?? null;

  return {
    estimatedDebtFreeDate: toProjectedDate(
      optimizedResult.selectedPlan.monthsToPayoff,
    ),
    potentialSavings:
      optimizedResult.savingsVsMinimumOnly ?? comparison.interestSavings ?? 0,
    monthlyEssentialExpensesTotal: cashflow.monthlyEssentialExpensesTotal ?? 0,
    monthlyDebtCapacity: cashflow.monthlyDebtCapacity ?? 0,
    recommendedStrategy: comparison.recommendedStrategy,
    recommendedStrategyLabel: getStrategyLabel(comparison.recommendedStrategy),
    priorityDebtName: priorityDebt?.name ?? null,
    immediateAction: comparison.immediateAction,
    monthsToDebtFree: optimizedResult.selectedPlan.monthsToPayoff,
    monthsSaved: optimizedResult.monthsSavedVsMinimumOnly,
  };
}

export async function completeUserOnboarding(
  userId: string,
  input: OnboardingInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const preview = buildOnboardingPreview(input);
  const resolvedDebts = resolveOnboardingDebts(input);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    });

    if (!user) {
      throw new ServiceError("USER_NOT_FOUND", 404, "No se encontró la cuenta.");
    }

    if (user.onboardingCompleted) {
      return;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        settings: {
          upsert: {
            create: {
              defaultCurrency: CurrencyCode.DOP,
              preferredStrategy: preview.recommendedStrategy,
              monthlyIncome: input.monthlyIncome,
              monthlyHousingCost: input.monthlyHousingCost,
              monthlyGroceriesCost: input.monthlyGroceriesCost,
              monthlyUtilitiesCost: input.monthlyUtilitiesCost,
              monthlyTransportCost: input.monthlyTransportCost,
              monthlyOtherEssentialExpenses: input.monthlyOtherEssentialExpenses,
              monthlyDebtBudget: input.monthlyDebtBudget,
              membershipTier: "FREE",
              notifyDueSoon: true,
              notifyOverdue: true,
              notifyMinimumRisk: true,
              notifyMonthlyReport: true,
              emailRemindersEnabled: false,
              preferredReminderDays: [5, 2, 0],
              preferredReminderHour: 8,
              upcomingDueDays: 3,
            },
            update: {
              preferredStrategy: preview.recommendedStrategy,
              monthlyIncome: input.monthlyIncome,
              monthlyHousingCost: input.monthlyHousingCost,
              monthlyGroceriesCost: input.monthlyGroceriesCost,
              monthlyUtilitiesCost: input.monthlyUtilitiesCost,
              monthlyTransportCost: input.monthlyTransportCost,
              monthlyOtherEssentialExpenses: input.monthlyOtherEssentialExpenses,
              monthlyDebtBudget: input.monthlyDebtBudget,
            },
          },
        },
      },
    });

    await tx.debt.createMany({
      data: resolvedDebts.map((debt) => ({
        userId,
        name: debt.name,
        creditorName: debt.creditorName,
        type: debt.type,
        status: DebtStatus.CURRENT,
        currency: CurrencyCode.DOP,
        currentBalance: debt.currentBalance,
        interestRate: debt.interestRate,
        interestRateType: InterestRateType.ANNUAL,
        minimumPayment: debt.minimumPayment,
      })),
    });

    await createAuditLog(
      {
        userId,
        action: AuditAction.SETTINGS_UPDATED,
        resourceType: "onboarding",
        resourceId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          monthlyIncome: input.monthlyIncome,
          monthlyEssentialExpensesTotal: preview.monthlyEssentialExpensesTotal,
          monthlyDebtCapacity: preview.monthlyDebtCapacity,
          monthlyDebtBudget: input.monthlyDebtBudget,
          debtCount: resolvedDebts.length,
          recommendedStrategy: preview.recommendedStrategy,
          priorityDebtName: preview.priorityDebtName,
        },
      },
      tx,
    );

    await captureBalanceSnapshot(
      userId,
      BalanceSnapshotSource.MUTATION,
      tx,
    );
  });

  return preview;
}
