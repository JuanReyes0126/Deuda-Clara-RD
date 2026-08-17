import { addMonths } from "date-fns";
import { StrategyMethod } from "@prisma/client";

import type { DashboardPlanComparisonDto, DashboardPlanSnapshotDto } from "@/lib/types/app";
import type {
  SimulationSummary,
  StrategyDebtInput,
  StrategyResult,
} from "@/server/planner/strategy-engine";
import { calculateDebtStrategy } from "@/server/planner/strategy-engine";

const OPTIMIZATION_STRATEGIES = [
  StrategyMethod.AVALANCHE,
  StrategyMethod.SNOWBALL,
  StrategyMethod.HYBRID,
] as const;

type OptimizationRun = {
  strategy: StrategyMethod;
  result: StrategyResult;
};

type OptimizationInput = {
  debts: StrategyDebtInput[];
  currentStrategy: StrategyMethod;
  monthlyBudget?: number | null;
  hybridRateWeight?: number | null;
  hybridBalanceWeight?: number | null;
};

function buildStrategyOptions(input: {
  strategy: StrategyMethod;
  monthlyBudget?: number | null | undefined;
  hybridRateWeight?: number | null | undefined;
  hybridBalanceWeight?: number | null | undefined;
}) {
  return {
    strategy: input.strategy,
    ...(input.monthlyBudget !== null && input.monthlyBudget !== undefined
      ? { monthlyBudget: input.monthlyBudget }
      : {}),
    hybridRateWeight: input.hybridRateWeight ?? 70,
    hybridBalanceWeight: input.hybridBalanceWeight ?? 30,
  };
}

function buildStrategyLabel(strategy: StrategyMethod | "CURRENT") {
  if (strategy === "CURRENT") {
    return "Plan actual";
  }

  if (strategy === StrategyMethod.AVALANCHE) {
    return "Avalancha";
  }

  if (strategy === StrategyMethod.SNOWBALL) {
    return "Bola de nieve";
  }

  return "Híbrido";
}

function compareSimulationSummary(left: SimulationSummary, right: SimulationSummary) {
  if (left.feasible !== right.feasible) {
    return left.feasible ? -1 : 1;
  }

  const leftMonths = left.monthsToPayoff ?? Number.POSITIVE_INFINITY;
  const rightMonths = right.monthsToPayoff ?? Number.POSITIVE_INFINITY;

  if (leftMonths !== rightMonths) {
    return leftMonths - rightMonths;
  }

  if (left.totalInterest !== right.totalInterest) {
    return left.totalInterest - right.totalInterest;
  }

  return left.remainingBalance - right.remainingBalance;
}

function pickBetterRun(currentBest: OptimizationRun, candidate: OptimizationRun) {
  const summaryComparison = compareSimulationSummary(
    currentBest.result.selectedPlan,
    candidate.result.selectedPlan,
  );

  if (summaryComparison < 0) {
    return currentBest;
  }

  if (summaryComparison > 0) {
    return candidate;
  }

  if (candidate.strategy === StrategyMethod.AVALANCHE) {
    return candidate;
  }

  return currentBest;
}

function buildSuggestedExtra(totalMinimumPayment: number) {
  if (totalMinimumPayment <= 0) {
    return 0;
  }

  const rawSuggestion = Math.max(1_000, totalMinimumPayment * 0.12);
  const roundedSuggestion = Math.ceil(rawSuggestion / 500) * 500;

  return Math.min(roundedSuggestion, 12_000);
}

function hasMeaningfulImprovement(interestSavings: number | null, monthsSaved: number | null) {
  return (interestSavings ?? 0) > 0 || (monthsSaved ?? 0) > 0;
}

function buildPlanSnapshot(input: {
  label: string;
  strategy: StrategyMethod | "CURRENT";
  monthlyBudget: number;
  plan: SimulationSummary;
}) {
  const projectedDebtFreeDate =
    input.plan.monthsToPayoff !== null
      ? addMonths(new Date(), input.plan.monthsToPayoff).toISOString()
      : null;

  return {
    label: input.label,
    strategy:
      input.strategy === "CURRENT"
        ? "CURRENT"
        : input.strategy,
    strategyLabel: buildStrategyLabel(input.strategy),
    monthlyBudget: input.monthlyBudget,
    monthsToDebtFree: input.plan.monthsToPayoff,
    projectedDebtFreeDate,
    totalInterest: input.plan.totalInterest,
    totalPaid: input.plan.totalPaid,
    remainingBalance: input.plan.remainingBalance,
    feasible: input.plan.feasible,
    reason: input.plan.reason,
  } satisfies DashboardPlanSnapshotDto;
}

function buildComparisonText(input: {
  currentStrategy: StrategyMethod;
  optimizedStrategy: StrategyMethod;
  assumption: string | null;
  savings: number | null;
  monthsSaved: number | null;
}) {
  if (input.assumption) {
    return {
      headline: `Plan recomendado: ${buildStrategyLabel(input.optimizedStrategy)}`,
      description: input.assumption,
    };
  }

  if (
    input.currentStrategy === input.optimizedStrategy &&
    !hasMeaningfulImprovement(input.savings, input.monthsSaved)
  ) {
    return {
      headline: `Tu estrategia ${buildStrategyLabel(input.currentStrategy).toLowerCase()} ya luce bien calibrada`,
      description:
        "Con tu presupuesto actual, el orden que ya estás usando no muestra una mejora material frente a otras estrategias.",
    };
  }

  return {
    headline: `Plan recomendado: ${buildStrategyLabel(input.optimizedStrategy)}`,
    description:
      "El sistema comparó avalanche, bola de nieve e híbrido con tus datos actuales para proponerte la ruta más eficiente.",
  };
}

export function buildDashboardPlanComparison(input: OptimizationInput) {
  const baseRuns = OPTIMIZATION_STRATEGIES.map((strategy) => ({
    strategy,
    result: calculateDebtStrategy(
      input.debts,
      buildStrategyOptions({
        strategy,
        monthlyBudget: input.monthlyBudget,
        hybridRateWeight: input.hybridRateWeight,
        hybridBalanceWeight: input.hybridBalanceWeight,
      }),
    ),
  }));
  const currentRun =
    baseRuns.find((run) => run.strategy === input.currentStrategy) ?? baseRuns[0]!;
  let optimizedRun = baseRuns.reduce(pickBetterRun);
  let interestSavings =
    currentRun.result.selectedPlan.feasible && optimizedRun.result.selectedPlan.feasible
      ? Number(
          (
            currentRun.result.selectedPlan.totalInterest -
            optimizedRun.result.selectedPlan.totalInterest
          ).toFixed(2),
        )
      : null;
  let monthsSaved =
    currentRun.result.selectedPlan.monthsToPayoff !== null &&
    optimizedRun.result.selectedPlan.monthsToPayoff !== null
      ? currentRun.result.selectedPlan.monthsToPayoff -
        optimizedRun.result.selectedPlan.monthsToPayoff
      : null;
  let assumption: string | null = null;

  if (!hasMeaningfulImprovement(interestSavings, monthsSaved)) {
    const suggestedExtra = buildSuggestedExtra(currentRun.result.totalMinimumPayment);

    if (suggestedExtra > 0) {
      const boostedRuns = OPTIMIZATION_STRATEGIES.map((strategy) => ({
        strategy,
        result: calculateDebtStrategy(
          input.debts,
          buildStrategyOptions({
            strategy,
            monthlyBudget: currentRun.result.selectedMonthlyBudget + suggestedExtra,
            hybridRateWeight: input.hybridRateWeight,
            hybridBalanceWeight: input.hybridBalanceWeight,
          }),
        ),
      }));
      const boostedBestRun = boostedRuns.reduce(pickBetterRun);
      const boostedInterestSavings =
        currentRun.result.selectedPlan.feasible && boostedBestRun.result.selectedPlan.feasible
          ? Number(
              (
                currentRun.result.selectedPlan.totalInterest -
                boostedBestRun.result.selectedPlan.totalInterest
              ).toFixed(2),
            )
          : null;
      const boostedMonthsSaved =
        currentRun.result.selectedPlan.monthsToPayoff !== null &&
        boostedBestRun.result.selectedPlan.monthsToPayoff !== null
          ? currentRun.result.selectedPlan.monthsToPayoff -
            boostedBestRun.result.selectedPlan.monthsToPayoff
          : null;

      if (hasMeaningfulImprovement(boostedInterestSavings, boostedMonthsSaved)) {
        optimizedRun = boostedBestRun;
        interestSavings = boostedInterestSavings;
        monthsSaved = boostedMonthsSaved;
        assumption =
          currentRun.result.selectedMonthlyBudget <= currentRun.result.totalMinimumPayment
            ? `Hoy prácticamente vas a mínimos. Para producir una mejora visible, el sistema simuló RD$${suggestedExtra.toLocaleString("es-DO")} extra al mes.`
            : `Para recortar tiempo e intereses, el plan recomendado asume RD$${suggestedExtra.toLocaleString("es-DO")} adicionales sobre tu presupuesto mensual actual.`;
      }
    }
  }

  const comparisonText = buildComparisonText({
    currentStrategy: input.currentStrategy,
    optimizedStrategy: optimizedRun.strategy,
    assumption,
    savings: interestSavings,
    monthsSaved,
  });
  const firstRecommendedDebt = optimizedRun.result.recommendedOrder[0];

  return {
    comparison: {
      headline: comparisonText.headline,
      description: comparisonText.description,
      recommendedStrategy: optimizedRun.strategy,
      interestSavings,
      monthsSaved,
      suggestedMonthlyBudget: optimizedRun.result.selectedMonthlyBudget,
      inferredExtraPayment: Math.max(
        optimizedRun.result.selectedMonthlyBudget - currentRun.result.selectedMonthlyBudget,
        0,
      ),
      assumption,
      immediateAction: firstRecommendedDebt
        ? `Ataca primero ${firstRecommendedDebt.name}. Cubre los mínimos del resto y envía todo excedente a esa deuda.`
        : "Registra al menos una deuda activa para generar una recomendación accionable.",
      currentPlan: buildPlanSnapshot({
        label: "Plan actual",
        strategy: currentRun.strategy,
        monthlyBudget: currentRun.result.selectedMonthlyBudget,
        plan: currentRun.result.selectedPlan,
      }),
      optimizedPlan: buildPlanSnapshot({
        label: "Plan recomendado",
        strategy: optimizedRun.strategy,
        monthlyBudget: optimizedRun.result.selectedMonthlyBudget,
        plan: optimizedRun.result.selectedPlan,
      }),
    } satisfies DashboardPlanComparisonDto,
    optimizedResult: optimizedRun.result,
  };
}
