import Decimal from "decimal.js";
import { DebtStatus, DebtType, InterestRateType, StrategyMethod } from "@prisma/client";

type DecimalValue = Decimal.Value;

const MAX_MONTHS = 600;

export type StrategyDebtInput = {
  id: string;
  name: string;
  type: DebtType;
  status: DebtStatus;
  currentBalance: DecimalValue;
  interestRate: DecimalValue;
  interestRateType: InterestRateType;
  minimumPayment: DecimalValue;
  lateFeeAmount?: DecimalValue | null;
  extraChargesAmount?: DecimalValue | null;
  nextDueDate?: Date | string | null;
  projectedMonthlyCharge?: DecimalValue | null;
};

export type StrategyOptions = {
  strategy: StrategyMethod;
  monthlyBudget?: DecimalValue | null;
  hybridRateWeight?: number;
  hybridBalanceWeight?: number;
  focusDebtId?: string | null;
};

type WorkingDebt = {
  id: string;
  name: string;
  type: DebtType;
  monthlyRate: Decimal;
  minimumPayment: Decimal;
  balance: Decimal;
  originalBalance: Decimal;
  nextDueDate?: Date | null;
  projectedMonthlyCharge: Decimal;
  payoffMonth: number | null;
  totalInterestPaid: Decimal;
};

export type StrategyRecommendation = {
  id: string;
  name: string;
  priorityRank: number;
  score: number;
  balance: number;
  monthlyRatePct: number;
  explanation: string;
};

export type SimulationSummary = {
  feasible: boolean;
  reason: "budget_below_minimum" | "non_amortizing" | "max_months_reached" | null;
  monthsToPayoff: number | null;
  totalInterest: number;
  totalPaid: number;
  remainingBalance: number;
  monthlyProjection: Array<{ month: number; totalBalance: number }>;
  debtPayoffs: Array<{ id: string; name: string; payoffMonth: number | null }>;
};

export type StrategyResult = {
  debtCount: number;
  totalBalance: number;
  totalMinimumPayment: number;
  totalEstimatedMonthlyInterest: number;
  selectedMonthlyBudget: number;
  recommendedOrder: StrategyRecommendation[];
  currentPlan: SimulationSummary;
  selectedPlan: SimulationSummary;
  savingsVsMinimumOnly: number | null;
  monthsSavedVsMinimumOnly: number | null;
  strategyExplanation: string;
};

function money(value: DecimalValue | null | undefined) {
  return new Decimal(value ?? 0);
}

function roundMoney(value: Decimal) {
  return Number(value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
}

function toMonthlyRate(interestRate: DecimalValue, rateType: InterestRateType) {
  const normalizedRate = money(interestRate).div(100);
  return rateType === InterestRateType.MONTHLY
    ? normalizedRate
    : normalizedRate.div(12);
}

function buildEffectiveBalance(input: StrategyDebtInput) {
  return money(input.currentBalance)
    .plus(money(input.lateFeeAmount))
    .plus(money(input.extraChargesAmount));
}

function normalizeDebts(debts: StrategyDebtInput[]): WorkingDebt[] {
  return debts
    .filter((debt) => debt.status !== DebtStatus.PAID && debt.status !== DebtStatus.ARCHIVED)
    .map((debt) => {
      const balance = buildEffectiveBalance(debt);

      return {
        id: debt.id,
        name: debt.name,
        type: debt.type,
        monthlyRate: toMonthlyRate(debt.interestRate, debt.interestRateType),
        minimumPayment: Decimal.max(money(debt.minimumPayment), 0),
        balance,
        originalBalance: balance,
        nextDueDate: debt.nextDueDate ? new Date(debt.nextDueDate) : null,
        projectedMonthlyCharge: money(debt.projectedMonthlyCharge),
        payoffMonth: null,
        totalInterestPaid: new Decimal(0),
      };
    })
    .filter((debt) => debt.balance.greaterThan(0));
}

function buildStrategyScore(
  debts: WorkingDebt[],
  debt: WorkingDebt,
  strategy: StrategyMethod,
  hybridRateWeight: number,
  hybridBalanceWeight: number,
) {
  const maxRate = Decimal.max(...debts.map((item) => item.monthlyRate), new Decimal(0.000001));
  const maxBalance = Decimal.max(...debts.map((item) => item.balance), new Decimal(1));
  const rateScore = debt.monthlyRate.div(maxRate).toNumber();
  const balanceScore = new Decimal(1).minus(debt.balance.div(maxBalance)).toNumber();

  if (strategy === StrategyMethod.AVALANCHE) {
    return rateScore * 100 + balanceScore;
  }

  if (strategy === StrategyMethod.SNOWBALL) {
    return balanceScore * 100 + rateScore;
  }

  return rateScore * hybridRateWeight + balanceScore * hybridBalanceWeight;
}

function orderDebts(
  debts: WorkingDebt[],
  strategy: StrategyMethod,
  hybridRateWeight = 70,
  hybridBalanceWeight = 30,
  focusDebtId?: string | null,
) {
  return debts
    .slice()
    .sort((left, right) => {
      if (focusDebtId) {
        if (left.id === focusDebtId && right.id !== focusDebtId) {
          return -1;
        }

        if (right.id === focusDebtId && left.id !== focusDebtId) {
          return 1;
        }
      }

      const rightScore = buildStrategyScore(
        debts,
        right,
        strategy,
        hybridRateWeight,
        hybridBalanceWeight,
      );
      const leftScore = buildStrategyScore(
        debts,
        left,
        strategy,
        hybridRateWeight,
        hybridBalanceWeight,
      );

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (!left.nextDueDate && !right.nextDueDate) {
        return 0;
      }

      if (!left.nextDueDate) {
        return 1;
      }

      if (!right.nextDueDate) {
        return -1;
      }

      return left.nextDueDate.getTime() - right.nextDueDate.getTime();
    });
}

function cloneDebts(debts: WorkingDebt[]) {
  return debts.map((debt) => ({
    ...debt,
    monthlyRate: new Decimal(debt.monthlyRate),
    minimumPayment: new Decimal(debt.minimumPayment),
    balance: new Decimal(debt.balance),
    originalBalance: new Decimal(debt.originalBalance),
    projectedMonthlyCharge: new Decimal(debt.projectedMonthlyCharge),
    totalInterestPaid: new Decimal(debt.totalInterestPaid),
  }));
}

function simulateRepaymentPlan(
  debts: WorkingDebt[],
  options: StrategyOptions,
  mode: "minimum_only" | "strategy",
): SimulationSummary {
  const workingDebts = cloneDebts(debts);
  const monthlyMinimumTotal = workingDebts.reduce(
    (sum, debt) => sum.plus(Decimal.min(debt.balance, debt.minimumPayment)),
    new Decimal(0),
  );
  const selectedBudget =
    mode === "minimum_only"
      ? monthlyMinimumTotal
      : Decimal.max(money(options.monthlyBudget), monthlyMinimumTotal);
  const monthlyProjection: Array<{ month: number; totalBalance: number }> = [];
  let totalPaid = new Decimal(0);
  let totalInterest = new Decimal(0);

  for (let month = 1; month <= MAX_MONTHS; month += 1) {
    const activeDebts = workingDebts.filter((debt) => debt.balance.greaterThan(0));

    if (!activeDebts.length) {
      return {
        feasible: true,
        reason: null,
        monthsToPayoff: month - 1,
        totalInterest: roundMoney(totalInterest),
        totalPaid: roundMoney(totalPaid),
        remainingBalance: 0,
        monthlyProjection,
        debtPayoffs: workingDebts.map((debt) => ({
          id: debt.id,
          name: debt.name,
          payoffMonth: debt.payoffMonth,
        })),
      };
    }

    const orderedDebts = orderDebts(
      activeDebts,
      options.strategy,
      options.hybridRateWeight,
      options.hybridBalanceWeight,
      options.focusDebtId,
    );
    const startingBalance = activeDebts.reduce(
      (sum, debt) => sum.plus(debt.balance),
      new Decimal(0),
    );

    orderedDebts.forEach((debt) => {
      if (debt.projectedMonthlyCharge.greaterThan(0)) {
        debt.balance = debt.balance.plus(debt.projectedMonthlyCharge);
      }

      const interest = debt.balance.mul(debt.monthlyRate);
      debt.balance = debt.balance.plus(interest);
      debt.totalInterestPaid = debt.totalInterestPaid.plus(interest);
      totalInterest = totalInterest.plus(interest);
    });

    const minimumDue = orderedDebts.reduce(
      (sum, debt) => sum.plus(Decimal.min(debt.balance, debt.minimumPayment)),
      new Decimal(0),
    );
    const budgetThisMonth = mode === "minimum_only" ? minimumDue : selectedBudget;

    if (budgetThisMonth.lessThan(minimumDue)) {
      return {
        feasible: false,
        reason: "budget_below_minimum",
        monthsToPayoff: null,
        totalInterest: roundMoney(totalInterest),
        totalPaid: roundMoney(totalPaid),
        remainingBalance: roundMoney(
          orderedDebts.reduce((sum, debt) => sum.plus(debt.balance), new Decimal(0)),
        ),
        monthlyProjection,
        debtPayoffs: workingDebts.map((debt) => ({
          id: debt.id,
          name: debt.name,
          payoffMonth: debt.payoffMonth,
        })),
      };
    }

    let remainingBudget = budgetThisMonth;

    orderedDebts.forEach((debt) => {
      const minimumPayment = Decimal.min(debt.balance, debt.minimumPayment, remainingBudget);

      debt.balance = debt.balance.minus(minimumPayment);
      totalPaid = totalPaid.plus(minimumPayment);
      remainingBudget = remainingBudget.minus(minimumPayment);
    });

    for (const debt of orderedDebts) {
      if (remainingBudget.lessThanOrEqualTo(0)) {
        break;
      }

      const extraPayment = Decimal.min(debt.balance, remainingBudget);
      debt.balance = debt.balance.minus(extraPayment);
      totalPaid = totalPaid.plus(extraPayment);
      remainingBudget = remainingBudget.minus(extraPayment);
    }

    const endingBalance = orderedDebts.reduce(
      (sum, debt) => sum.plus(Decimal.max(debt.balance, 0)),
      new Decimal(0),
    );

    orderedDebts.forEach((debt) => {
      if (debt.balance.lessThanOrEqualTo(0) && debt.payoffMonth === null) {
        debt.balance = new Decimal(0);
        debt.payoffMonth = month;
      }
    });

    monthlyProjection.push({
      month,
      totalBalance: roundMoney(endingBalance),
    });

    if (
      endingBalance.greaterThanOrEqualTo(startingBalance) &&
      budgetThisMonth.lessThanOrEqualTo(minimumDue)
    ) {
      return {
        feasible: false,
        reason: "non_amortizing",
        monthsToPayoff: null,
        totalInterest: roundMoney(totalInterest),
        totalPaid: roundMoney(totalPaid),
        remainingBalance: roundMoney(endingBalance),
        monthlyProjection,
        debtPayoffs: workingDebts.map((debt) => ({
          id: debt.id,
          name: debt.name,
          payoffMonth: debt.payoffMonth,
        })),
      };
    }
  }

  return {
    feasible: false,
    reason: "max_months_reached",
    monthsToPayoff: null,
    totalInterest: roundMoney(totalInterest),
    totalPaid: roundMoney(totalPaid),
    remainingBalance: roundMoney(
      workingDebts.reduce((sum, debt) => sum.plus(debt.balance), new Decimal(0)),
    ),
    monthlyProjection,
    debtPayoffs: workingDebts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      payoffMonth: debt.payoffMonth,
    })),
  };
}

function buildExplanation(strategy: StrategyMethod) {
  if (strategy === StrategyMethod.AVALANCHE) {
    return "Avalanche prioriza la deuda con mayor tasa para reducir intereses lo antes posible.";
  }

  if (strategy === StrategyMethod.SNOWBALL) {
    return "Snowball prioriza el saldo más pequeño para generar tracción y victorias rápidas.";
  }

  return "La estrategia híbrida combina tasa e impacto emocional del saldo para una ruta intermedia.";
}

export function calculateDebtStrategy(
  debts: StrategyDebtInput[],
  options: StrategyOptions,
): StrategyResult {
  const normalizedDebts = normalizeDebts(debts);
  const totalBalance = normalizedDebts.reduce(
    (sum, debt) => sum.plus(debt.balance),
    new Decimal(0),
  );
  const totalMinimumPayment = normalizedDebts.reduce(
    (sum, debt) => sum.plus(Decimal.min(debt.balance, debt.minimumPayment)),
    new Decimal(0),
  );
  const totalEstimatedMonthlyInterest = normalizedDebts.reduce(
    (sum, debt) => sum.plus(debt.balance.mul(debt.monthlyRate)),
    new Decimal(0),
  );
  const orderedDebts = orderDebts(
    normalizedDebts,
    options.strategy,
    options.hybridRateWeight,
    options.hybridBalanceWeight,
    options.focusDebtId,
  );
  const selectedBudget = Decimal.max(
    money(options.monthlyBudget),
    totalMinimumPayment,
  );
  const currentPlan = simulateRepaymentPlan(normalizedDebts, options, "minimum_only");
  const selectedPlan = simulateRepaymentPlan(normalizedDebts, options, "strategy");

  return {
    debtCount: normalizedDebts.length,
    totalBalance: roundMoney(totalBalance),
    totalMinimumPayment: roundMoney(totalMinimumPayment),
    totalEstimatedMonthlyInterest: roundMoney(totalEstimatedMonthlyInterest),
    selectedMonthlyBudget: roundMoney(selectedBudget),
    recommendedOrder: orderedDebts.map((debt, index) => {
      const score = buildStrategyScore(
        orderedDebts,
        debt,
        options.strategy,
        options.hybridRateWeight ?? 70,
        options.hybridBalanceWeight ?? 30,
      );

      return {
        id: debt.id,
        name: debt.name,
        priorityRank: index + 1,
        score,
        balance: roundMoney(debt.balance),
        monthlyRatePct: debt.monthlyRate.mul(100).toDecimalPlaces(2).toNumber(),
        explanation:
          options.strategy === StrategyMethod.AVALANCHE
            ? "Sube al frente por tasa alta."
            : options.strategy === StrategyMethod.SNOWBALL
              ? "Sube al frente por saldo más pequeño."
              : "Sube al frente por el balance entre tasa y tamaño.",
      };
    }),
    currentPlan,
    selectedPlan,
    savingsVsMinimumOnly:
      currentPlan.feasible && selectedPlan.feasible
        ? roundMoney(new Decimal(currentPlan.totalInterest).minus(selectedPlan.totalInterest))
        : null,
    monthsSavedVsMinimumOnly:
      currentPlan.monthsToPayoff !== null && selectedPlan.monthsToPayoff !== null
        ? currentPlan.monthsToPayoff - selectedPlan.monthsToPayoff
        : null,
    strategyExplanation: buildExplanation(options.strategy),
  };
}
