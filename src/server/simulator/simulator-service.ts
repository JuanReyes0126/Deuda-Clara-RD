import type {
  Debt,
  DebtStatus,
  DebtType,
  InterestRateType,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { listDemoDebts } from "@/lib/demo/debts";
import { demoDebts } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import type { DebtItemDto, SimulatorResultDto } from "@/lib/types/app";
import type { SimulatorInput } from "@/lib/validations/simulator";
import { calculateDebtStrategy } from "@/server/planner/strategy-engine";

type SimulatorDebtSource =
  | Pick<
      Debt,
      | "id"
      | "name"
      | "type"
      | "status"
      | "currentBalance"
      | "interestRate"
      | "interestRateType"
      | "minimumPayment"
      | "lateFeeAmount"
      | "extraChargesAmount"
      | "nextDueDate"
    >
  | Pick<
      DebtItemDto,
      | "id"
      | "name"
      | "type"
      | "status"
      | "currentBalance"
      | "interestRate"
      | "interestRateType"
      | "minimumPayment"
      | "lateFeeAmount"
      | "extraChargesAmount"
      | "nextDueDate"
    >;

function mapSimulatorDebtSource(debt: SimulatorDebtSource) {
  return {
    id: debt.id,
    name: debt.name,
    type: debt.type as DebtType,
    status: debt.status as DebtStatus,
    currentBalance: debt.currentBalance,
    interestRate: debt.interestRate,
    interestRateType: debt.interestRateType as InterestRateType,
    minimumPayment: debt.minimumPayment,
    lateFeeAmount: debt.lateFeeAmount,
    extraChargesAmount: debt.extraChargesAmount,
    nextDueDate: debt.nextDueDate,
  };
}

function buildScenarioDebts(
  debts: SimulatorDebtSource[],
  options?: {
    focusDebtId?: string | undefined;
    cardToFreezeId?: string | undefined;
    monthlyCardUsageToStop?: number | undefined;
    refinanceDebtId?: string | undefined;
    refinancedRate?: number | undefined;
  },
) {
  return debts.map((debt) => ({
    ...mapSimulatorDebtSource(debt),
    projectedMonthlyCharge:
      options?.cardToFreezeId === debt.id ? options.monthlyCardUsageToStop ?? 0 : 0,
    interestRate:
      options?.refinanceDebtId === debt.id && options.refinancedRate !== undefined
        ? options.refinancedRate
        : debt.interestRate,
  }));
}

function buildSimulatorResult(
  debts: SimulatorDebtSource[],
  input: SimulatorInput,
  options?: {
    hybridRateWeight?: number | null | undefined;
    hybridBalanceWeight?: number | null | undefined;
  },
): SimulatorResultDto {
  const hybridRateWeight = options?.hybridRateWeight ?? 70;
  const hybridBalanceWeight = options?.hybridBalanceWeight ?? 30;
  const baseDebts = buildScenarioDebts(debts);
  const basePlan = calculateDebtStrategy(baseDebts, {
    strategy: input.strategy,
    monthlyBudget: input.monthlyBudget,
    hybridRateWeight,
    hybridBalanceWeight,
  });
  const extraPaymentPlan = calculateDebtStrategy(baseDebts, {
    strategy: input.strategy,
    monthlyBudget: input.monthlyBudget + (input.extraMonthlyPayment ?? 0),
    hybridRateWeight,
    hybridBalanceWeight,
  });
  const focusedDebtPlan = calculateDebtStrategy(baseDebts, {
    strategy: input.strategy,
    monthlyBudget: input.monthlyBudget,
    hybridRateWeight,
    hybridBalanceWeight,
    ...(input.focusedDebtId ? { focusDebtId: input.focusedDebtId } : {}),
  });
  const freezeBaseline = calculateDebtStrategy(
    buildScenarioDebts(debts, {
      cardToFreezeId: input.cardToFreezeId,
      monthlyCardUsageToStop: input.monthlyCardUsageToStop ?? 0,
    }),
    {
      strategy: input.strategy,
      monthlyBudget: input.monthlyBudget,
      hybridRateWeight,
      hybridBalanceWeight,
    },
  );
  const freezeCardPlan = calculateDebtStrategy(
    buildScenarioDebts(debts, {
      cardToFreezeId: input.cardToFreezeId,
      monthlyCardUsageToStop: 0,
    }),
    {
      strategy: input.strategy,
      monthlyBudget: input.monthlyBudget,
      hybridRateWeight,
      hybridBalanceWeight,
    },
  );
  const refinancePlan = calculateDebtStrategy(
    buildScenarioDebts(debts, {
      refinanceDebtId: input.refinanceDebtId,
      refinancedRate: input.refinancedRate,
    }),
    {
      strategy: input.strategy,
      monthlyBudget: input.monthlyBudget,
      hybridRateWeight,
      hybridBalanceWeight,
    },
  );

  return {
    basePlan: {
      monthsToPayoff: basePlan.selectedPlan.monthsToPayoff,
      totalInterest: basePlan.selectedPlan.totalInterest,
      totalPaid: basePlan.selectedPlan.totalPaid,
      remainingBalance: basePlan.selectedPlan.remainingBalance,
    },
    extraPaymentPlan: {
      monthsToPayoff: extraPaymentPlan.selectedPlan.monthsToPayoff,
      totalInterest: extraPaymentPlan.selectedPlan.totalInterest,
      savings:
        basePlan.selectedPlan.feasible && extraPaymentPlan.selectedPlan.feasible
          ? basePlan.selectedPlan.totalInterest - extraPaymentPlan.selectedPlan.totalInterest
          : null,
    },
    focusedDebtPlan: {
      focusedDebtId: input.focusedDebtId ?? null,
      monthsToPayoff: focusedDebtPlan.selectedPlan.monthsToPayoff,
      totalInterest: focusedDebtPlan.selectedPlan.totalInterest,
      savings:
        basePlan.selectedPlan.feasible && focusedDebtPlan.selectedPlan.feasible
          ? basePlan.selectedPlan.totalInterest - focusedDebtPlan.selectedPlan.totalInterest
          : null,
    },
    freezeCardPlan: {
      cardId: input.cardToFreezeId ?? null,
      monthlySpendStopped: input.monthlyCardUsageToStop ?? 0,
      monthsToPayoff: freezeCardPlan.selectedPlan.monthsToPayoff,
      totalInterest: freezeCardPlan.selectedPlan.totalInterest,
      savings:
        freezeBaseline.selectedPlan.feasible && freezeCardPlan.selectedPlan.feasible
          ? freezeBaseline.selectedPlan.totalInterest - freezeCardPlan.selectedPlan.totalInterest
          : null,
    },
    refinancePlan: {
      debtId: input.refinanceDebtId ?? null,
      newRate: input.refinancedRate ?? null,
      monthsToPayoff: refinancePlan.selectedPlan.monthsToPayoff,
      totalInterest: refinancePlan.selectedPlan.totalInterest,
      savings:
        basePlan.selectedPlan.feasible && refinancePlan.selectedPlan.feasible
          ? basePlan.selectedPlan.totalInterest - refinancePlan.selectedPlan.totalInterest
          : null,
    },
    selectedStrategyExplanation: basePlan.strategyExplanation,
    monthlyProjection:
      extraPaymentPlan.selectedPlan.monthlyProjection.length > 0
        ? extraPaymentPlan.selectedPlan.monthlyProjection
        : basePlan.selectedPlan.monthlyProjection,
  };
}

export function runFallbackSimulator(
  input: SimulatorInput,
  debts: SimulatorDebtSource[] = demoDebts,
): SimulatorResultDto {
  return buildSimulatorResult(debts, input);
}

export async function runSimulator(userId: string, input: SimulatorInput): Promise<SimulatorResultDto> {
  if (isDemoSessionUser({ id: userId })) {
    return runFallbackSimulator(input, await listDemoDebts(false));
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
      debts: {
        where: {
          archivedAt: null,
          status: {
            notIn: ["PAID", "ARCHIVED"],
          },
        },
      },
    },
  });

  return buildSimulatorResult(user.debts, input, {
    hybridRateWeight: user.settings?.hybridRateWeight,
    hybridBalanceWeight: user.settings?.hybridBalanceWeight,
  });
}
