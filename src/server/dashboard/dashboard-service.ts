import { addMonths, addWeeks, format, startOfWeek, subDays } from "date-fns";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { buildMonthlyCashflowSnapshot } from "@/lib/finance/monthly-cashflow";
import { resolveFeatureAccess } from "@/lib/feature-access";
import { getMembershipPlan } from "@/lib/membership/plans";
import type {
  DashboardDto,
  DebtItemDto,
  MembershipConversionSnapshotDto,
} from "@/lib/types/app";
import { decimal, toMoneyNumber } from "@/lib/utils/decimal";
import {
  buildStrategyDebtInput,
  getDebtMonthlyRate,
  isMinimumPaymentRisk,
  mapDebtToDto,
  mapPaymentToDto,
} from "@/server/finance/debt-helpers";
import { calculateDebtStrategy } from "@/server/planner/strategy-engine";
import { isBillingConfigured } from "@/server/billing/billing-service";
import { buildDashboardFinancialCoach } from "@/server/dashboard/financial-coach";
import { buildDashboardPlanComparison } from "@/server/dashboard/plan-optimization";
import { buildUpcomingReminderTimeline } from "@/server/reminders/reminder-engine";
import { buildPaydownChallengeDto } from "@/server/dashboard/paydown-challenge";

type MembershipSnapshotInput = {
  debts: Array<
    | Parameters<typeof buildStrategyDebtInput>[0]
    | DebtItemDto
  >;
  preferredStrategy?: "AVALANCHE" | "SNOWBALL" | "HYBRID" | null;
  monthlyDebtBudget?: number | null;
  monthlyIncome?: number | null;
  monthlyHousingCost?: number | null;
  monthlyGroceriesCost?: number | null;
  monthlyUtilitiesCost?: number | null;
  monthlyTransportCost?: number | null;
  monthlyOtherEssentialExpenses?: number | null;
  hybridRateWeight?: number | null;
  hybridBalanceWeight?: number | null;
};

const dashboardUserInclude = {
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
    take: 40,
  },
  balanceSnapshots: {
    orderBy: {
      capturedAt: "asc",
    },
    take: 12,
  },
} satisfies Prisma.UserInclude;

type DashboardSourceUser = Prisma.UserGetPayload<{
  include: typeof dashboardUserInclude;
}>;

function buildEmptyMembershipConversionSnapshot(): MembershipConversionSnapshotDto {
  return {
    hasDebts: false,
    totalDebt: 0,
    estimatedMonthlyInterest: 0,
    monthlyIncome: null,
    monthlyEssentialExpensesTotal: null,
    monthlyDebtCapacity: null,
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

function buildWeeklyStreak(
  payments: Array<{ paidAt: Date }>,
  now = new Date(),
) {
  if (payments.length === 0) {
    return 0;
  }

  const paidWeeks = new Set(
    payments.map((payment) =>
      startOfWeek(payment.paidAt, { weekStartsOn: 1 }).toISOString(),
    ),
  );
  let streak = 0;
  let cursor = startOfWeek(now, { weekStartsOn: 1 });

  while (paidWeeks.has(cursor.toISOString())) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }

  return streak;
}

function sumPaymentsInWindow(
  payments: Array<{ paidAt: Date; amount: Prisma.Decimal | number }>,
  from: Date,
  to: Date,
) {
  return payments.reduce((sum, payment) => {
    if (payment.paidAt < from || payment.paidAt >= to) {
      return sum;
    }

    return sum + toMoneyNumber(payment.amount);
  }, 0);
}

function rankDebtsForAnalysis(left: DashboardSourceUser["debts"][number], right: DashboardSourceUser["debts"][number]) {
  const leftUrgency = left.status === "LATE" ? 0 : 1;
  const rightUrgency = right.status === "LATE" ? 0 : 1;

  if (leftUrgency !== rightUrgency) {
    return leftUrgency - rightUrgency;
  }

  const leftDueTime = left.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightDueTime = right.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;

  if (leftDueTime !== rightDueTime) {
    return leftDueTime - rightDueTime;
  }

  const leftMonthlyInterest =
    toMoneyNumber(left.currentBalance) *
    getDebtMonthlyRate(left.interestRate, left.interestRateType).toNumber();
  const rightMonthlyInterest =
    toMoneyNumber(right.currentBalance) *
    getDebtMonthlyRate(right.interestRate, right.interestRateType).toNumber();

  return rightMonthlyInterest - leftMonthlyInterest;
}

export function buildDashboardHabitSignals(input: {
  hasDebts: boolean;
  payments: Array<{ paidAt: Date; amount: Prisma.Decimal | number }>;
  riskAlertCount: number;
  interestSavings: number | null;
  now?: Date;
}) {
  if (!input.hasDebts) {
    return {
      weeklyStreak: 0,
      reviewPrompt: "Registra tu primera deuda para activar tu plan.",
      momentumMessage: "Todavía no hay suficiente contexto para medir avance.",
      microFeedback: "En cuanto registres una deuda, te diremos por dónde empezar.",
    };
  }

  const now = input.now ?? new Date();
  const weeklyStreak = buildWeeklyStreak(input.payments, now);
  const last7Days = subDays(now, 7);
  const last30Days = subDays(now, 30);
  const previous30Days = subDays(now, 60);
  const hasRecentActivity = input.payments.some(
    (payment) => payment.paidAt >= last7Days,
  );
  const recentWindowPaid = sumPaymentsInWindow(input.payments, last30Days, now);
  const previousWindowPaid = sumPaymentsInWindow(
    input.payments,
    previous30Days,
    last30Days,
  );

  const reviewPrompt = hasRecentActivity
    ? null
    : "Revisa tu plan esta semana para no atrasarte.";

  let momentumMessage = "Mantenerte al día este mes ya es una mejora real.";

  if (recentWindowPaid > previousWindowPaid && previousWindowPaid > 0) {
    momentumMessage = "Vas mejor que el mes pasado.";
  } else if (recentWindowPaid > 0 && previousWindowPaid === 0) {
    momentumMessage = "Buen movimiento: este mes ya empezaste a bajar capital.";
  } else if (recentWindowPaid === 0) {
    momentumMessage = "Todavía no hay pagos este mes. Conviene retomar el ritmo.";
  } else if (recentWindowPaid < previousWindowPaid) {
    momentumMessage = "Este mes viene más lento que el anterior. Ajustarlo ahora te ayuda.";
  }

  let microFeedback = "Buen movimiento, te estás manteniendo al día.";

  if (input.riskAlertCount > 0) {
    microFeedback =
      "No te atrases: conviene reforzar la deuda que más intereses te cobra.";
  } else if ((input.interestSavings ?? 0) > 0) {
    microFeedback = "Buen movimiento, estás reduciendo intereses.";
  } else if (weeklyStreak >= 2) {
    microFeedback = "Ya tienes un hábito visible. Sostenerlo ahora vale mucho.";
  }

  return {
    weeklyStreak,
    reviewPrompt,
    momentumMessage,
    microFeedback,
  };
}

export function buildMembershipConversionSnapshot(input: MembershipSnapshotInput): MembershipConversionSnapshotDto {
  const cashflow = buildMonthlyCashflowSnapshot({
    monthlyIncome: input.monthlyIncome ?? null,
    monthlyHousingCost: input.monthlyHousingCost ?? null,
    monthlyGroceriesCost: input.monthlyGroceriesCost ?? null,
    monthlyUtilitiesCost: input.monthlyUtilitiesCost ?? null,
    monthlyTransportCost: input.monthlyTransportCost ?? null,
    monthlyOtherEssentialExpenses: input.monthlyOtherEssentialExpenses ?? null,
  });
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
    monthlyIncome: cashflow.monthlyIncome,
    monthlyEssentialExpensesTotal: cashflow.monthlyEssentialExpensesTotal,
    monthlyDebtCapacity: cashflow.monthlyDebtCapacity,
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

function buildDashboardDataFromUser(user: DashboardSourceUser): DashboardDto {
  const cashflow = buildMonthlyCashflowSnapshot({
    monthlyIncome:
      user.settings?.monthlyIncome !== null && user.settings?.monthlyIncome !== undefined
        ? toMoneyNumber(user.settings.monthlyIncome)
        : null,
    monthlyHousingCost:
      user.settings?.monthlyHousingCost !== null &&
      user.settings?.monthlyHousingCost !== undefined
        ? toMoneyNumber(user.settings.monthlyHousingCost)
        : null,
    monthlyGroceriesCost:
      user.settings?.monthlyGroceriesCost !== null &&
      user.settings?.monthlyGroceriesCost !== undefined
        ? toMoneyNumber(user.settings.monthlyGroceriesCost)
        : null,
    monthlyUtilitiesCost:
      user.settings?.monthlyUtilitiesCost !== null &&
      user.settings?.monthlyUtilitiesCost !== undefined
        ? toMoneyNumber(user.settings.monthlyUtilitiesCost)
        : null,
    monthlyTransportCost:
      user.settings?.monthlyTransportCost !== null &&
      user.settings?.monthlyTransportCost !== undefined
        ? toMoneyNumber(user.settings.monthlyTransportCost)
        : null,
    monthlyOtherEssentialExpenses:
      user.settings?.monthlyOtherEssentialExpenses !== null &&
      user.settings?.monthlyOtherEssentialExpenses !== undefined
        ? toMoneyNumber(user.settings.monthlyOtherEssentialExpenses)
        : null,
  });
  const activeDebts = user.debts.filter((debt) => debt.status !== "PAID" && debt.status !== "ARCHIVED");
  const membershipPlan = getMembershipPlan(user.settings?.membershipTier);
  const membershipBillingStatus = user.settings?.membershipBillingStatus ?? "FREE";
  const access = resolveFeatureAccess({
    membershipTier: user.settings?.membershipTier,
    membershipBillingStatus,
  });
  const recommendationUnlocked = access.canAccessPremiumOptimization;
  const analyzedDebts = access.isBase
    ? activeDebts.slice().sort(rankDebtsForAnalysis).slice(0, access.maxActiveDebts)
    : activeDebts;
  const hiddenDebtCount = Math.max(0, activeDebts.length - analyzedDebts.length);
  const strategyDebts = analyzedDebts.map(buildStrategyDebtInput);
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
  const totalDebt = activeDebts.reduce(
    (sum, debt) =>
      sum +
      toMoneyNumber(debt.currentBalance) +
      toMoneyNumber(debt.lateFeeAmount) +
      toMoneyNumber(debt.extraChargesAmount),
    0,
  );
  const totalMinimumPayment = activeDebts.reduce(
    (sum, debt) => sum + toMoneyNumber(debt.minimumPayment),
    0,
  );
  const totalEstimatedMonthlyInterest = activeDebts.reduce(
    (sum, debt) =>
      sum +
      toMoneyNumber(debt.currentBalance) *
        getDebtMonthlyRate(debt.interestRate, debt.interestRateType).toNumber(),
    0,
  );
  const paidVsPendingPercentage =
    totalDebt + totalPaidRecorded.toNumber() > 0
      ? Number(
          totalPaidRecorded
            .div(totalPaidRecorded.plus(totalDebt))
            .mul(100)
            .toDecimalPlaces(1),
        )
      : 0;
  const dueSoonDebts = analyzedDebts
    .filter((debt) => debt.nextDueDate)
    .sort((left, right) => {
      if (!left.nextDueDate || !right.nextDueDate) {
        return 0;
      }

      return left.nextDueDate.getTime() - right.nextDueDate.getTime();
    })
    .slice(0, access.dueSoonLimit)
    .map(mapDebtToDto);
  const urgentDebt = analyzedDebts
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

  for (const debt of analyzedDebts) {
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
  const riskAlerts = analyzedDebts
    .filter((debt) => isMinimumPaymentRisk(debt))
    .slice(0, access.riskAlertLimit)
    .map((debt) => ({
      title: `Pago mínimo riesgoso: ${debt.name}`,
      description: `El pago mínimo de ${debt.name} apenas cubre interés estimado. Necesitas meterle más flujo.`,
    }));
  const habitSignals = buildDashboardHabitSignals({
    hasDebts: activeDebts.length > 0,
    payments: user.payments.map((payment) => ({
      paidAt: payment.paidAt,
      amount: payment.amount,
    })),
    riskAlertCount: riskAlerts.length,
    interestSavings: recommendationUnlocked ? planComparison.interestSavings : null,
  });
  const upcomingTimeline = buildUpcomingReminderTimeline({
    debts: analyzedDebts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      type: debt.type,
      currency: debt.currency,
      minimumPayment: toMoneyNumber(debt.minimumPayment),
      statementDay: debt.statementDay,
      dueDay: debt.dueDay,
      nextDueDate: debt.nextDueDate,
      notificationsEnabled: debt.notificationsEnabled,
    })),
    settings: {
      timezone: user.settings?.timezone ?? user.timezone,
      preferredReminderDays: user.settings?.preferredReminderDays ?? [5, 2, 0],
      preferredReminderHour: user.settings?.preferredReminderHour ?? 8,
    },
  });
  const limitedUpcomingTimeline = {
    ...upcomingTimeline,
    items: upcomingTimeline.items.slice(0, access.upcomingTimelineLimit),
  };
  const recentPayments = user.payments
    .slice(0, access.recentPaymentsLimit)
    .map(mapPaymentToDto);
  const activeDebtDtos = activeDebts.map(mapDebtToDto);
  const dueSoonDebtDtos = dueSoonDebts;
  const urgentDebtDto = urgentDebt ? mapDebtToDto(urgentDebt) : null;
  const assistantCoach = buildDashboardFinancialCoach({
    analysisScope: {
      hiddenDebtCount,
      partialAnalysis: hiddenDebtCount > 0,
    },
    summary: {
      totalDebt,
      totalMinimumPayment,
      monthlyIncome: cashflow.monthlyIncome,
      monthlyEssentialExpensesTotal: cashflow.monthlyEssentialExpensesTotal,
      monthlyDebtCapacity: cashflow.monthlyDebtCapacity,
      estimatedMonthlyInterest: totalEstimatedMonthlyInterest,
      recommendedDebtName: recommendedDebt?.name ?? null,
      recommendedDebtId: recommendedDebt?.id ?? null,
      interestSavings: recommendationUnlocked ? planComparison.interestSavings : null,
    },
    planComparison: access.canSeeFullPlanComparison ? planComparison : null,
    habitSignals,
    dueSoonDebts: dueSoonDebtDtos,
    urgentDebt: urgentDebtDto,
    riskAlerts,
    recentPayments,
  });

  return {
    summary: {
      totalDebt,
      totalMinimumPayment,
      currentMonthlyBudget: strategy.selectedMonthlyBudget,
      monthlyIncome: cashflow.monthlyIncome,
      monthlyEssentialExpensesTotal: cashflow.monthlyEssentialExpensesTotal,
      monthlyDebtCapacity: cashflow.monthlyDebtCapacity,
      estimatedMonthlyInterest: totalEstimatedMonthlyInterest,
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
      billingConfigured: isBillingConfigured(),
    },
    analysisScope: {
      activeDebtCount: activeDebts.length,
      analyzedDebtCount: analyzedDebts.length,
      hiddenDebtCount,
      partialAnalysis: hiddenDebtCount > 0,
    },
    planComparison: access.canSeeFullPlanComparison ? planComparison : null,
    habitSignals,
    upcomingTimeline: limitedUpcomingTimeline,
    debtBreakdown: Array.from(debtBreakdownMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    balanceHistory: user.balanceSnapshots.slice(-access.balanceHistoryPoints).map((snapshot) => ({
      label: format(snapshot.capturedAt, "MMM yy"),
      totalBalance: toMoneyNumber(snapshot.totalBalance),
    })),
    activeDebts: activeDebtDtos,
    recentPayments,
    dueSoonDebts: dueSoonDebtDtos,
    urgentDebt: urgentDebtDto,
    assistantCoach,
    recommendedOrder: access.canAccessPremiumOptimization
      ? optimizedResult.recommendedOrder
      : [],
    strategyExplanation: access.canAccessPremiumOptimization
      ? `${optimizedResult.strategyExplanation} ${membershipPlan.guidanceLabel}.`
      : "El plan recomendado está disponible en los planes Premium y Pro.",
    riskAlerts,
    paydownChallenge: buildPaydownChallengeDto(
      user.settings,
      user.payments.map((payment) => ({ paidAt: payment.paidAt })),
    ),
  };
}

async function getDashboardSourceUser(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: dashboardUserInclude,
  });
}

export async function getDashboardPageData(userId: string): Promise<{
  data: DashboardDto;
  conversionSnapshot: MembershipConversionSnapshotDto;
}> {
  const user = await getDashboardSourceUser(userId);
  const conversionSnapshot = buildMembershipConversionSnapshot({
    debts: user.debts,
    preferredStrategy: user.settings?.preferredStrategy ?? "AVALANCHE",
    monthlyDebtBudget:
      user.settings?.monthlyDebtBudget !== null &&
      user.settings?.monthlyDebtBudget !== undefined
        ? toMoneyNumber(user.settings.monthlyDebtBudget)
        : null,
    monthlyIncome:
      user.settings?.monthlyIncome !== null && user.settings?.monthlyIncome !== undefined
        ? toMoneyNumber(user.settings.monthlyIncome)
        : null,
    monthlyHousingCost:
      user.settings?.monthlyHousingCost !== null &&
      user.settings?.monthlyHousingCost !== undefined
        ? toMoneyNumber(user.settings.monthlyHousingCost)
        : null,
    monthlyGroceriesCost:
      user.settings?.monthlyGroceriesCost !== null &&
      user.settings?.monthlyGroceriesCost !== undefined
        ? toMoneyNumber(user.settings.monthlyGroceriesCost)
        : null,
    monthlyUtilitiesCost:
      user.settings?.monthlyUtilitiesCost !== null &&
      user.settings?.monthlyUtilitiesCost !== undefined
        ? toMoneyNumber(user.settings.monthlyUtilitiesCost)
        : null,
    monthlyTransportCost:
      user.settings?.monthlyTransportCost !== null &&
      user.settings?.monthlyTransportCost !== undefined
        ? toMoneyNumber(user.settings.monthlyTransportCost)
        : null,
    monthlyOtherEssentialExpenses:
      user.settings?.monthlyOtherEssentialExpenses !== null &&
      user.settings?.monthlyOtherEssentialExpenses !== undefined
        ? toMoneyNumber(user.settings.monthlyOtherEssentialExpenses)
        : null,
    hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
    hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
  });

  return {
    data: buildDashboardDataFromUser(user),
    conversionSnapshot,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardDto> {
  return (await getDashboardPageData(userId)).data;
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
    monthlyIncome:
      user.settings?.monthlyIncome !== null && user.settings?.monthlyIncome !== undefined
        ? toMoneyNumber(user.settings.monthlyIncome)
        : null,
    monthlyHousingCost:
      user.settings?.monthlyHousingCost !== null &&
      user.settings?.monthlyHousingCost !== undefined
        ? toMoneyNumber(user.settings.monthlyHousingCost)
        : null,
    monthlyGroceriesCost:
      user.settings?.monthlyGroceriesCost !== null &&
      user.settings?.monthlyGroceriesCost !== undefined
        ? toMoneyNumber(user.settings.monthlyGroceriesCost)
        : null,
    monthlyUtilitiesCost:
      user.settings?.monthlyUtilitiesCost !== null &&
      user.settings?.monthlyUtilitiesCost !== undefined
        ? toMoneyNumber(user.settings.monthlyUtilitiesCost)
        : null,
    monthlyTransportCost:
      user.settings?.monthlyTransportCost !== null &&
      user.settings?.monthlyTransportCost !== undefined
        ? toMoneyNumber(user.settings.monthlyTransportCost)
        : null,
    monthlyOtherEssentialExpenses:
      user.settings?.monthlyOtherEssentialExpenses !== null &&
      user.settings?.monthlyOtherEssentialExpenses !== undefined
        ? toMoneyNumber(user.settings.monthlyOtherEssentialExpenses)
        : null,
    hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
    hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
  });
}
