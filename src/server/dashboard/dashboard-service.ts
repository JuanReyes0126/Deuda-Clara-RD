import { addMonths, format } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { getMembershipPlan, hasMembershipAccess } from "@/lib/membership/plans";
import type {
  DashboardDto,
  DebtItemDto,
  MembershipConversionSnapshotDto,
} from "@/lib/types/app";
import { decimal, toMoneyNumber } from "@/lib/utils/decimal";
import {
  buildStrategyDebtInput,
  isMinimumPaymentRisk,
  mapDebtToDto,
  mapPaymentToDto,
} from "@/server/finance/debt-helpers";
import { calculateDebtStrategy } from "@/server/planner/strategy-engine";
import { isStripeBillingConfigured } from "@/server/billing/billing-service";
import { syncUserNotifications } from "@/server/notifications/notification-service";
import { buildDashboardPlanComparison } from "@/server/dashboard/plan-optimization";

type MembershipSnapshotInput = {
  debts: Array<
    | Parameters<typeof buildStrategyDebtInput>[0]
    | DebtItemDto
  >;
  preferredStrategy?: "AVALANCHE" | "SNOWBALL" | "HYBRID" | null;
  monthlyDebtBudget?: number | null;
  hybridRateWeight?: number | null;
  hybridBalanceWeight?: number | null;
};

function buildEmptyMembershipConversionSnapshot(): MembershipConversionSnapshotDto {
  return {
    hasDebts: false,
    totalDebt: 0,
    estimatedMonthlyInterest: 0,
    currentMonthlyBudget: 0,
    suggestedMonthlyBudget: 0,
    inferredExtraPayment: 0,
    currentMonthsToDebtFree: null,
    optimizedMonthsToDebtFree: null,
    currentDebtFreeDate: null,
    optimizedDebtFreeDate: null,
    interestSavings: null,
    monthsSaved: null,
    recommendedStrategyLabel: "Pendiente de datos",
    immediateAction: "Registra al menos una deuda activa para generar una recomendación real.",
    urgentDebtName: null,
    dueSoonCount: 0,
    riskAlertCount: 0,
  };
}

export function buildMembershipConversionSnapshot(input: MembershipSnapshotInput): MembershipConversionSnapshotDto {
  const activeDebts = input.debts.filter(
    (debt) => debt.status !== "PAID" && debt.status !== "ARCHIVED",
  );

  if (activeDebts.length === 0) {
    return buildEmptyMembershipConversionSnapshot();
  }

  const strategyDebts = activeDebts.map(buildStrategyDebtInput);
  const strategy = calculateDebtStrategy(strategyDebts, {
    strategy: input.preferredStrategy ?? "AVALANCHE",
    ...(input.monthlyDebtBudget !== null && input.monthlyDebtBudget !== undefined
      ? { monthlyBudget: input.monthlyDebtBudget }
      : {}),
    hybridRateWeight: input.hybridRateWeight ?? 70,
    hybridBalanceWeight: input.hybridBalanceWeight ?? 30,
  });
  const { comparison: planComparison } = buildDashboardPlanComparison({
    debts: strategyDebts,
    currentStrategy: input.preferredStrategy ?? "AVALANCHE",
    ...(input.monthlyDebtBudget !== null && input.monthlyDebtBudget !== undefined
      ? { monthlyBudget: toMoneyNumber(input.monthlyDebtBudget) }
      : {}),
    hybridRateWeight: input.hybridRateWeight ?? 70,
    hybridBalanceWeight: input.hybridBalanceWeight ?? 30,
  });
  const urgentDebt = activeDebts
    .slice()
    .sort((left, right) => {
      const leftUrgency = left.status === "LATE" ? 0 : 1;
      const rightUrgency = right.status === "LATE" ? 0 : 1;

      if (leftUrgency !== rightUrgency) {
        return leftUrgency - rightUrgency;
      }

      return (left.nextDueDate ? new Date(left.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER) -
        (right.nextDueDate ? new Date(right.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER);
    })[0];
  const dueSoonCount = activeDebts.filter((debt) => debt.nextDueDate).length;
  const riskAlertCount = activeDebts.filter((debt) => isMinimumPaymentRisk(debt)).length;

  return {
    hasDebts: true,
    totalDebt: strategy.totalBalance,
    estimatedMonthlyInterest: strategy.totalEstimatedMonthlyInterest,
    currentMonthlyBudget: strategy.selectedMonthlyBudget,
    suggestedMonthlyBudget: planComparison.suggestedMonthlyBudget,
    inferredExtraPayment: planComparison.inferredExtraPayment,
    currentMonthsToDebtFree: planComparison.currentPlan.monthsToDebtFree,
    optimizedMonthsToDebtFree: planComparison.optimizedPlan.monthsToDebtFree,
    currentDebtFreeDate: planComparison.currentPlan.projectedDebtFreeDate,
    optimizedDebtFreeDate: planComparison.optimizedPlan.projectedDebtFreeDate,
    interestSavings: planComparison.interestSavings,
    monthsSaved: planComparison.monthsSaved,
    recommendedStrategyLabel: planComparison.optimizedPlan.strategyLabel,
    immediateAction: planComparison.immediateAction,
    urgentDebtName: urgentDebt?.name ?? null,
    dueSoonCount,
    riskAlertCount,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardDto> {
  await syncUserNotifications(userId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
      debts: {
        include: {
          payments: {
            orderBy: {
              paidAt: "desc",
            },
          },
        },
        where: {
          archivedAt: null,
        },
      },
      payments: {
        include: {
          debt: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          paidAt: "desc",
        },
        take: 8,
      },
      balanceSnapshots: {
        orderBy: {
          capturedAt: "asc",
        },
        take: 12,
      },
    },
  });

  const activeDebts = user.debts.filter((debt) => debt.status !== "PAID" && debt.status !== "ARCHIVED");
  const membershipPlan = getMembershipPlan(user.settings?.membershipTier);
  const membershipBillingStatus = user.settings?.membershipBillingStatus ?? "FREE";
  const recommendationUnlocked = hasMembershipAccess(
    user.settings?.membershipTier,
    membershipBillingStatus,
  );
  const strategyDebts = activeDebts.map(buildStrategyDebtInput);
  const strategy = calculateDebtStrategy(
    strategyDebts,
    {
      strategy: user.settings?.preferredStrategy ?? "AVALANCHE",
      ...(user.settings?.monthlyDebtBudget !== null &&
      user.settings?.monthlyDebtBudget !== undefined
        ? { monthlyBudget: user.settings.monthlyDebtBudget }
        : {}),
      hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
      hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
    },
  );
  const { comparison: planComparison, optimizedResult } = buildDashboardPlanComparison({
    debts: strategyDebts,
    currentStrategy: user.settings?.preferredStrategy ?? "AVALANCHE",
    ...(user.settings?.monthlyDebtBudget !== null &&
    user.settings?.monthlyDebtBudget !== undefined
      ? { monthlyBudget: toMoneyNumber(user.settings.monthlyDebtBudget) }
      : {}),
    hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
    hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
  });
  const totalPaidRecorded = user.payments.reduce((sum, payment) => sum.plus(payment.amount), decimal(0));
  const totalDebt = strategy.totalBalance;
  const paidVsPendingPercentage =
    totalDebt + totalPaidRecorded.toNumber() > 0
      ? Number(
          totalPaidRecorded
            .div(totalPaidRecorded.plus(totalDebt))
            .mul(100)
            .toDecimalPlaces(1),
        )
      : 0;
  const dueSoonDebts = activeDebts
    .filter((debt) => debt.nextDueDate)
    .sort((left, right) => {
      if (!left.nextDueDate || !right.nextDueDate) {
        return 0;
      }

      return left.nextDueDate.getTime() - right.nextDueDate.getTime();
    })
    .slice(0, 4)
    .map(mapDebtToDto);
  const urgentDebt = activeDebts
    .slice()
    .sort((left, right) => {
      const leftUrgency = left.status === "LATE" ? 0 : 1;
      const rightUrgency = right.status === "LATE" ? 0 : 1;

      if (leftUrgency !== rightUrgency) {
        return leftUrgency - rightUrgency;
      }

      return (left.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER);
    })[0];
  const debtBreakdownMap = new Map<string, number>();

  for (const debt of activeDebts) {
    debtBreakdownMap.set(
      debt.type,
      (debtBreakdownMap.get(debt.type) ?? 0) +
        toMoneyNumber(debt.currentBalance) +
        toMoneyNumber(debt.lateFeeAmount) +
        toMoneyNumber(debt.extraChargesAmount),
    );
  }

  const recommendedDebt =
    recommendationUnlocked ? optimizedResult.recommendedOrder[0] ?? null : null;
  const projectedDebtFreeDate =
    recommendationUnlocked
      ? optimizedResult.selectedPlan.monthsToPayoff !== null
        ? addMonths(new Date(), optimizedResult.selectedPlan.monthsToPayoff).toISOString()
        : null
      : strategy.selectedPlan.monthsToPayoff !== null
        ? addMonths(new Date(), strategy.selectedPlan.monthsToPayoff).toISOString()
      : null;
  const riskAlerts = activeDebts
    .filter((debt) => isMinimumPaymentRisk(debt))
    .slice(0, 3)
    .map((debt) => ({
      title: `Pago mínimo riesgoso: ${debt.name}`,
      description: `El pago mínimo de ${debt.name} apenas cubre interés estimado. Necesitas meterle más flujo.`,
    }));

  return {
    summary: {
      totalDebt,
      totalMinimumPayment: strategy.totalMinimumPayment,
      currentMonthlyBudget: strategy.selectedMonthlyBudget,
      estimatedMonthlyInterest: strategy.totalEstimatedMonthlyInterest,
      paidVsPendingPercentage,
      projectedDebtFreeDate,
      recommendedDebtName: recommendedDebt?.name ?? null,
      recommendedDebtId: recommendedDebt?.id ?? null,
      monthsToDebtFree: recommendationUnlocked
        ? optimizedResult.selectedPlan.monthsToPayoff
        : strategy.selectedPlan.monthsToPayoff,
      interestSavings: recommendationUnlocked
        ? planComparison.interestSavings
        : null,
    },
    membership: {
      tier: membershipPlan.id,
      billingStatus: membershipBillingStatus,
      label: membershipPlan.label,
      guidanceLabel: membershipPlan.guidanceLabel,
      durationMonths: membershipPlan.durationMonths,
      monthlyPriceUsd: membershipPlan.monthlyPriceUsd,
      recommendationUnlocked,
      description: membershipPlan.description,
      currentPeriodEnd: user.settings?.membershipCurrentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: user.settings?.membershipCancelAtPeriodEnd ?? false,
      billingConfigured: isStripeBillingConfigured(),
    },
    planComparison: recommendationUnlocked ? planComparison : null,
    debtBreakdown: Array.from(debtBreakdownMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    balanceHistory: user.balanceSnapshots.map((snapshot) => ({
      label: format(snapshot.capturedAt, "MMM yy"),
      totalBalance: toMoneyNumber(snapshot.totalBalance),
    })),
    recentPayments: user.payments.map(mapPaymentToDto),
    dueSoonDebts,
    urgentDebt: urgentDebt ? mapDebtToDto(urgentDebt) : null,
    recommendedOrder: recommendationUnlocked ? optimizedResult.recommendedOrder : [],
    strategyExplanation: recommendationUnlocked
      ? `${optimizedResult.strategyExplanation} ${membershipPlan.guidanceLabel}.`
      : "El plan recomendado está disponible en los planes Premium y Pro.",
    riskAlerts,
  };
}

export async function getMembershipConversionSnapshot(
  userId: string,
): Promise<MembershipConversionSnapshotDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
      debts: {
        where: {
          archivedAt: null,
        },
      },
    },
  });

  return buildMembershipConversionSnapshot({
    debts: user.debts,
    preferredStrategy: user.settings?.preferredStrategy ?? "AVALANCHE",
    monthlyDebtBudget:
      user.settings?.monthlyDebtBudget !== null &&
      user.settings?.monthlyDebtBudget !== undefined
        ? toMoneyNumber(user.settings.monthlyDebtBudget)
        : null,
    hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
    hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
  });
}
