"use client";

import type { StrategyMethod } from "@prisma/client";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { type FieldErrors, useForm, useWatch } from "react-hook-form";

import { BlurredInsight } from "@/components/membership/blurred-insight";
import { FeaturePreview } from "@/components/membership/feature-preview";
import { LockedCard } from "@/components/membership/locked-card";
import { UpgradeCTA } from "@/components/membership/upgrade-cta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContextMetricsGrid } from "@/components/shared/context-metrics-grid";
import { ModuleSectionHeader } from "@/components/shared/module-section-header";
import { PrimaryActionCard } from "@/components/shared/primary-action-card";
import { TrustInlineNote } from "@/components/shared/trust-inline-note";
import { SimulatorPortfolioProjection } from "@/features/simulator/components/simulator-portfolio-projection";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MEMBERSHIP_COMMERCIAL_COPY,
} from "@/config/membership-commercial-copy";
import { UPGRADE_MESSAGES, getSimulatorUpgradeNotes } from "@/config/upgrade-messages";
import {
  PRO_CONVERSION_COPY,
  buildProConversionCopy,
} from "@/config/pro-conversion-copy";
import {
  type MembershipBillingStatus,
  type MembershipPlanId,
} from "@/lib/membership/plans";
import { useSessionUpgradePrompt } from "@/lib/membership/use-session-upgrade-prompt";
import { resolveFeatureAccess } from "@/lib/feature-access";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { trackPlanEvent } from "@/lib/telemetry/plan-events";
import {
  simulateDebt,
  type DebtSimulationResult,
  type DebtSimulatorDebtType,
  type DebtSimulatorScenario,
  type DebtSimulatorScenarioId,
} from "@/lib/simulator/simulate-debt";
import type {
  DebtItemDto,
  MembershipConversionSnapshotDto,
} from "@/lib/types/app";
import { formatDate } from "@/lib/utils/date";

type SimulatorFormValues = {
  debtType: DebtSimulatorDebtType;
  principal: number;
  interestRate: number;
  interestRateType: "ANNUAL" | "MONTHLY";
  paymentAmount: number;
  extraPayment: number | undefined;
  startDate: string;
  paymentFrequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY";
};

type SimulatorDraftValues = {
  [Field in keyof SimulatorFormValues]: SimulatorFormValues[Field] | undefined;
};

type SimulatorParsedValues = Omit<SimulatorFormValues, "startDate"> & {
  startDate: Date;
};

type ParsedSimulatorFormValues =
  | { success: true; data: SimulatorParsedValues }
  | { success: false };

const debtTypeLabels: Record<DebtSimulatorDebtType, string> = {
  CREDIT_CARD: "Tarjeta de crédito",
  PERSONAL_LOAN: "Préstamo personal",
  FIXED_NO_INTEREST: "Cuota fija sin interés",
};

const frequencyLabels: Record<SimulatorFormValues["paymentFrequency"], string> = {
  MONTHLY: "Mensual",
  BIWEEKLY: "Quincenal",
  WEEKLY: "Semanal",
};

const interestRateTypeOptions = new Set<SimulatorFormValues["interestRateType"]>([
  "ANNUAL",
  "MONTHLY",
]);

const paymentFrequencyOptions = new Set<SimulatorFormValues["paymentFrequency"]>([
  "MONTHLY",
  "BIWEEKLY",
  "WEEKLY",
]);

const simulatorCurrencyFormatters = new Map<string, Intl.NumberFormat>();

function formatSimulatorCurrency(
  value: number,
  currency: DebtItemDto["currency"] = "DOP",
  fractionDigits = 2,
) {
  const formatterKey = `${currency}:${fractionDigits}`;

  if (!simulatorCurrencyFormatters.has(formatterKey)) {
    simulatorCurrencyFormatters.set(
      formatterKey,
      new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    );
  }

  return simulatorCurrencyFormatters
    .get(formatterKey)!
    .format(Number.isFinite(value) ? value : 0);
}

function formatRoundedCurrency(
  value: number,
  currency: DebtItemDto["currency"] = "DOP",
) {
  return formatSimulatorCurrency(value, currency, 0);
}

function formatMonthsValue(value: number | null) {
  if (value === null) {
    return "Sin salida clara";
  }

  if (value < 1) {
    return "< 1 mes";
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded} ${value === 1 ? "mes" : "meses"}`;
}

function formatLockedSavingsPreview(
  value: number,
  currency: DebtItemDto["currency"] = "DOP",
) {
  if (!Number.isFinite(value) || value <= 0) {
    return `Hasta ${formatRoundedCurrency(4000, currency)}`;
  }

  const rounded = Math.max(1000, Math.round(value / 1000) * 1000);
  return `Hasta ${formatRoundedCurrency(rounded, currency)}`;
}

function formatLockedMonthsPreview(value: number | null) {
  if (value === null || value <= 0) {
    return "Menos tiempo";
  }

  const rounded = Math.max(1, Math.round(value));
  return `${rounded} ${rounded === 1 ? "mes" : "meses"} menos`;
}

function requiredNumberValue(value: string) {
  return value === "" ? 0 : Number(value);
}

function optionalNumberValue(value: string) {
  return value === "" ? undefined : Number(value);
}

function buildPositiveMoneyValidation(message: string) {
  return {
    validate: (value: number) => {
      if (!Number.isFinite(value)) {
        return "Debes introducir un monto válido.";
      }

      if (value <= 0) {
        return message;
      }

      if (value > 999_999_999) {
        return "El monto es demasiado alto.";
      }

      return true;
    },
    setValueAs: requiredNumberValue,
  } as const;
}

const principalValidation = buildPositiveMoneyValidation(
  "El monto de la deuda debe ser mayor que cero.",
);

const paymentAmountValidation = buildPositiveMoneyValidation(
  "Debes introducir un pago mayor que cero.",
);

const interestRateValidation = {
  validate: (value: number) => {
    if (!Number.isFinite(value)) {
      return "Debes introducir una tasa válida.";
    }

    if (value < 0) {
      return "La tasa no puede ser negativa.";
    }

    if (value > 999) {
      return "La tasa es demasiado alta.";
    }

    return true;
  },
  setValueAs: requiredNumberValue,
} as const;

const extraPaymentValidation = {
  validate: (value: number | undefined) => {
    if (value === undefined) {
      return true;
    }

    if (!Number.isFinite(value)) {
      return "Debes introducir un monto válido.";
    }

    if (value < 0) {
      return "El monto no puede ser negativo.";
    }

    if (value > 999_999_999) {
      return "El monto es demasiado alto.";
    }

    return true;
  },
  setValueAs: optionalNumberValue,
} as const;

const startDateValidation = {
  validate: (value: string) => {
    return (
      (Boolean(value) && !Number.isNaN(new Date(value).getTime())) ||
      "Invalid Date"
    );
  },
} as const;

function mapDebtType(debt: DebtItemDto): DebtSimulatorDebtType {
  if (debt.type === "CREDIT_CARD") {
    return "CREDIT_CARD";
  }

  if ((debt.interestRate ?? 0) === 0 && (debt.monthlyInterestEstimate ?? 0) === 0) {
    return "FIXED_NO_INTEREST";
  }

  return "PERSONAL_LOAN";
}

function buildManualDefaults(): SimulatorFormValues {
  return {
    debtType: "PERSONAL_LOAN",
    principal: 85000,
    interestRate: 24,
    interestRateType: "ANNUAL",
    paymentAmount: 4500,
    extraPayment: 1000,
    startDate: new Date().toISOString().slice(0, 10),
    paymentFrequency: "MONTHLY",
  };
}

function buildDefaultsFromDebt(debt: DebtItemDto): SimulatorFormValues {
  const debtType = mapDebtType(debt);

  return {
    debtType,
    principal: debt.currentBalance,
    interestRate: debtType === "FIXED_NO_INTEREST" ? 0 : debt.interestRate,
    interestRateType:
      debt.interestRateType === "MONTHLY" ? "MONTHLY" : "ANNUAL",
    paymentAmount: debt.minimumPayment > 0 ? debt.minimumPayment : 3000,
    extraPayment: undefined,
    startDate:
      debt.startedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    paymentFrequency: "MONTHLY",
  };
}

function parseSimulatorFormValues(
  values: SimulatorDraftValues,
): ParsedSimulatorFormValues {
  const debtType = values.debtType;
  if (
    debtType !== "CREDIT_CARD" &&
    debtType !== "PERSONAL_LOAN" &&
    debtType !== "FIXED_NO_INTEREST"
  ) {
    return { success: false };
  }

  const principal = values.principal;
  if (
    typeof principal !== "number" ||
    !Number.isFinite(principal) ||
    principal <= 0 ||
    principal > 999_999_999
  ) {
    return { success: false };
  }

  const interestRate =
    debtType === "FIXED_NO_INTEREST" ? 0 : values.interestRate;
  if (
    typeof interestRate !== "number" ||
    !Number.isFinite(interestRate) ||
    interestRate < 0 ||
    interestRate > 999
  ) {
    return { success: false };
  }

  const interestRateType = values.interestRateType;
  if (!interestRateType || !interestRateTypeOptions.has(interestRateType)) {
    return { success: false };
  }

  const paymentAmount = values.paymentAmount;
  if (
    typeof paymentAmount !== "number" ||
    !Number.isFinite(paymentAmount) ||
    paymentAmount <= 0 ||
    paymentAmount > 999_999_999
  ) {
    return { success: false };
  }

  const extraPayment = values.extraPayment;
  if (
    extraPayment !== undefined &&
    (!Number.isFinite(extraPayment) ||
      extraPayment < 0 ||
      extraPayment > 999_999_999)
  ) {
    return { success: false };
  }

  const startDate = values.startDate;
  const parsedStartDate = startDate ? new Date(startDate) : null;
  if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime())) {
    return { success: false };
  }

  const paymentFrequency = values.paymentFrequency;
  if (!paymentFrequency || !paymentFrequencyOptions.has(paymentFrequency)) {
    return { success: false };
  }

  return {
    success: true,
    data: {
      debtType,
      principal,
      interestRate,
      interestRateType,
      paymentAmount,
      extraPayment,
      startDate: parsedStartDate,
      paymentFrequency,
    },
  };
}

function getFieldErrors(
  errors: FieldErrors<SimulatorFormValues>,
) {
  return [
    errors.principal?.message,
    errors.interestRate?.message,
    errors.paymentAmount?.message,
    errors.extraPayment?.message,
    errors.startDate?.message,
  ].filter(Boolean) as string[];
}

function getScenarioDelta(base: DebtSimulatorScenario, scenario: DebtSimulatorScenario) {
  if (!base.feasible || !scenario.feasible) {
    return {
      monthsSaved: null,
      interestSaved: 0,
      totalPaidSaved: 0,
    };
  }

  return {
    monthsSaved:
      base.monthsToPayoff !== null && scenario.monthsToPayoff !== null
        ? Number((base.monthsToPayoff - scenario.monthsToPayoff).toFixed(1))
        : null,
    interestSaved: Number((base.totalInterest - scenario.totalInterest).toFixed(2)),
    totalPaidSaved: Number((base.totalPaid - scenario.totalPaid).toFixed(2)),
  };
}

function getResultHeadline(
  result: DebtSimulationResult,
  currency: DebtItemDto["currency"] = "DOP",
) {
  if (!result.scenarios.base.feasible) {
    return {
      title: "Con ese pago todavía no hay salida sostenible.",
      description:
        "Sube la cuota o agrega un pago extra para que la deuda empiece a bajar de verdad.",
    };
  }

  if (
    result.savingsWithExtraPayment.monthsSaved !== null &&
    result.savingsWithExtraPayment.monthsSaved > 0
  ) {
    return {
      title: `Si sumas ese extra, podrías recortar ${formatMonthsValue(
        result.savingsWithExtraPayment.monthsSaved,
      )}.`,
      description: `Además evitarías ${formatSimulatorCurrency(
        result.savingsWithExtraPayment.interestSaved,
        currency,
      )} en intereses frente a tu pago actual.`,
    };
  }

  return {
    title: `Con tu pago actual saldrías en ${formatMonthsValue(result.monthsToPayoff)}.`,
    description: `Mantener ese ritmo te llevaría a pagar ${formatSimulatorCurrency(
      result.totalInterest,
      currency,
    )} en intereses.`,
  };
}

function getScenarioSummary(result: DebtSimulationResult) {
  const rows = [
    result.scenarios.base,
    result.scenarios.extra,
    result.scenarios.aggressive,
  ].filter(Boolean) as DebtSimulatorScenario[];

  const maxMonths =
    Math.max(
      ...rows.map((scenario) =>
        scenario.monthsToPayoff !== null ? scenario.monthsToPayoff : 0,
      ),
      1,
    ) || 1;

  return rows.map((scenario) => {
    const speedValue =
      scenario.monthsToPayoff && scenario.monthsToPayoff > 0
        ? maxMonths / scenario.monthsToPayoff
        : 0.15;

    return {
      scenario,
      relativeWidth: `${Math.max(18, Math.min(100, speedValue * 40))}%`,
    };
  });
}

function getScenarioSupportCopy(
  scenarioId: DebtSimulatorScenarioId,
  extraPayment: number,
) {
  if (scenarioId === "BASE") {
    return "Mantiene tu pago actual sin esfuerzo adicional.";
  }

  if (scenarioId === "EXTRA") {
    return extraPayment > 0
      ? "Usa exactamente el extra que introdujiste arriba."
      : "Te muestra el impacto apenas añadas un pago extra.";
  }

  return "Aprieta más el ritmo para ver el techo de mejora posible.";
}

function getSelectedSchedule(
  result: DebtSimulationResult | null,
  selectedScenarioId: DebtSimulatorScenarioId,
) {
  if (!result) {
    return null;
  }

  if (selectedScenarioId === "EXTRA") {
    return result.scenarios.extra;
  }

  if (selectedScenarioId === "AGGRESSIVE") {
    return result.scenarios.aggressive ?? result.scenarios.extra;
  }

  return result.scenarios.base;
}

function getBestVisibleScenario(result: DebtSimulationResult) {
  const ranked = [result.scenarios.extra, result.scenarios.aggressive]
    .filter(Boolean)
    .filter((scenario): scenario is DebtSimulatorScenario => Boolean(scenario?.feasible))
    .sort((left, right) => {
      if (left.totalInterest !== right.totalInterest) {
        return left.totalInterest - right.totalInterest;
      }

      return (left.monthsToPayoff ?? Number.MAX_SAFE_INTEGER) -
        (right.monthsToPayoff ?? Number.MAX_SAFE_INTEGER);
    });

  return ranked[0] ?? result.scenarios.extra;
}

export function SimulatorPanel({
  debts,
  preferredStrategy,
  conversionSnapshot: _conversionSnapshot = null,
  membershipTier,
  billingStatus,
}: {
  debts: DebtItemDto[];
  preferredStrategy: StrategyMethod;
  conversionSnapshot?: MembershipConversionSnapshotDto | null;
  membershipTier: MembershipPlanId;
  billingStatus: MembershipBillingStatus;
}) {
  const { navigate } = useAppNavigation();
  const highlightedPlanId: MembershipPlanId =
    membershipTier === "PRO" ? "PRO" : "NORMAL";
  const access = resolveFeatureAccess({
    membershipTier,
    membershipBillingStatus: billingStatus,
  });
  const [simulatorViewMode, setSimulatorViewMode] = useState<"single" | "portfolio">(() =>
    access.hasPaidAccess ? "portfolio" : "single",
  );
  const initialDebt = debts[0] ?? null;
  const [selectedDebtId, setSelectedDebtId] = useState(initialDebt?.id ?? "");
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<DebtSimulatorScenarioId>("EXTRA");
  const isPremiumUnlocked = access.canCompareScenarios;
  const isProUnlocked = access.canUseAutoStrategy || access.canSeeStepByStepPlan;
  const planUpgradeHref = `/planes?plan=${highlightedPlanId}&source=simulador`;
  const hasTrackedSimulatorUse = useRef(false);
  const hasTrackedPremiumPreview = useRef(false);

  const form = useForm<SimulatorFormValues>({
    mode: "onChange",
    defaultValues: initialDebt ? buildDefaultsFromDebt(initialDebt) : buildManualDefaults(),
  });
  const selectedDebt = useMemo(
    () => debts.find((debt) => debt.id === selectedDebtId) ?? null,
    [debts, selectedDebtId],
  );
  const selectedCurrency = selectedDebt?.currency ?? "DOP";
  const currencyBadgeLabel =
    selectedCurrency === "USD" ? "Formato USD" : "Formato RD$";
  const formatSimulationAmount = (value: number) =>
    formatSimulatorCurrency(value, selectedCurrency);

  const watchedValues = useWatch({
    control: form.control,
  });
  const deferredValues = useDeferredValue(watchedValues);

  const parsedSimulationInput = useMemo(() => {
    return parseSimulatorFormValues({
      debtType: deferredValues.debtType,
      principal: deferredValues.principal,
      interestRate:
        deferredValues.debtType === "FIXED_NO_INTEREST"
          ? 0
          : deferredValues.interestRate,
      interestRateType: deferredValues.interestRateType,
      paymentAmount: deferredValues.paymentAmount,
      extraPayment: deferredValues.extraPayment,
      startDate: deferredValues.startDate,
      paymentFrequency: deferredValues.paymentFrequency,
    });
  }, [deferredValues]);

  const simulation = useMemo(
    () =>
      parsedSimulationInput.success
        ? simulateDebt({
            debtType: parsedSimulationInput.data.debtType,
            principal: parsedSimulationInput.data.principal,
            interestRate: parsedSimulationInput.data.interestRate,
            interestRateType: parsedSimulationInput.data.interestRateType,
            paymentAmount: parsedSimulationInput.data.paymentAmount,
            startDate: parsedSimulationInput.data.startDate,
            paymentFrequency: parsedSimulationInput.data.paymentFrequency,
            ...(parsedSimulationInput.data.extraPayment === undefined
              ? {}
              : { extraPayment: parsedSimulationInput.data.extraPayment }),
          }, {
            access,
          })
        : null,
    [access, parsedSimulationInput],
  );
  const hasPremiumUpsellInsight =
    simulation !== null &&
    !isPremiumUnlocked &&
    (simulation.totalInterest > 0 ||
      simulation.savingsWithExtraPayment.interestSaved > 0);
  const hasProUpsellInsight =
    simulation !== null &&
    isPremiumUnlocked &&
    !isProUnlocked &&
    Boolean(simulation.recommendedStrategyLabel);
  const showSimulatorPremiumPrompt = useSessionUpgradePrompt({
    id: "simulator:premium",
    active: hasPremiumUpsellInsight,
  });
  const showSimulatorProPrompt = useSessionUpgradePrompt({
    id: "simulator:pro",
    active: hasProUpsellInsight,
  });
  const hasFinancialContext =
    _conversionSnapshot?.monthlyIncome !== null ||
    _conversionSnapshot?.monthlyEssentialExpensesTotal !== null ||
    _conversionSnapshot?.monthlyDebtCapacity !== null;

  const fieldErrors = getFieldErrors(form.formState.errors);
  const scenarioSummary = useMemo(
    () => (simulation ? getScenarioSummary(simulation) : []),
    [simulation],
  );
  const effectiveSelectedScenarioId =
    selectedScenarioId === "AGGRESSIVE" && !simulation?.scenarios.aggressive
      ? "EXTRA"
      : selectedScenarioId;
  const selectedScenario = getSelectedSchedule(
    simulation,
    effectiveSelectedScenarioId,
  );
  const resultHeadline = simulation
    ? getResultHeadline(simulation, selectedCurrency)
    : null;
  const comparisonRows = simulation
    ? [
        {
          scenario: simulation.scenarios.base,
          delta: { monthsSaved: null, interestSaved: 0, totalPaidSaved: 0 },
        },
        {
          scenario: simulation.scenarios.extra,
          delta: getScenarioDelta(simulation.scenarios.base, simulation.scenarios.extra),
        },
        ...(simulation.scenarios.aggressive
          ? [
              {
                scenario: simulation.scenarios.aggressive,
                delta: getScenarioDelta(
                  simulation.scenarios.base,
                  simulation.scenarios.aggressive,
                ),
              },
            ]
          : []),
      ]
    : [];

  const bestScenarioId = comparisonRows
    .filter((row) => row.scenario.id !== "BASE")
    .sort((left, right) => {
      if (right.delta.interestSaved !== left.delta.interestSaved) {
        return right.delta.interestSaved - left.delta.interestSaved;
      }

      return (
        (right.delta.monthsSaved ?? 0) - (left.delta.monthsSaved ?? 0)
      );
    })[0]?.scenario.id;
  const extraPaymentValue = watchedValues.extraPayment ?? 0;
  const lockedSavingsPreview = simulation
    ? formatLockedSavingsPreview(
        simulation.savingsWithExtraPayment.interestSaved,
        selectedCurrency,
      )
    : formatLockedSavingsPreview(0, selectedCurrency);
  const lockedMonthsPreview = simulation
    ? formatLockedMonthsPreview(simulation.savingsWithExtraPayment.monthsSaved)
    : "Menos tiempo";
  const simulatorActionTitle = !simulation
    ? "Completa los datos y verás una salida estimada en segundos."
    : !isPremiumUnlocked
      ? "Estás pagando más de lo necesario"
    : simulation.savingsWithExtraPayment.interestSaved > 0
      ? `Si subes el pago, podrías ahorrar ${formatSimulationAmount(
          simulation.savingsWithExtraPayment.interestSaved,
        )}.`
      : simulation.scenarios.base.feasible
        ? `Si mantienes este ritmo, sales en ${formatMonthsValue(
            simulation.monthsToPayoff,
          )}.`
        : "Con este pago la deuda todavía no baja de forma sostenible.";
  const simulatorActionDescription = !simulation
    ? "Empieza con monto, tasa y pago actual. La app te muestra tiempo, intereses y cuánto ganas si pagas más."
    : !isPremiumUnlocked
      ? "Con la estrategia correcta puedes reducir tiempo e intereses. Ahora mismo solo ves lo que te cuesta seguir igual."
    : simulation.savingsWithExtraPayment.interestSaved > 0
      ? `Ese ajuste te puede recortar ${formatMonthsValue(
          simulation.savingsWithExtraPayment.monthsSaved,
        )} y dejar menos dinero atrapado en intereses.`
      : simulation.scenarios.base.feasible
        ? "Ahora mismo ya tienes una lectura útil. El siguiente salto es probar un extra o una versión más agresiva."
        : "La cuota actual no cubre lo suficiente. Toca subir el pago o cambiar la estrategia.";
  const upgradeNotes = getSimulatorUpgradeNotes();
  const proConversionCopy = simulation
    ? (() => {
        const optimizedScenario = getBestVisibleScenario(simulation);
        const monthsSaved =
          simulation.scenarios.base.monthsToPayoff !== null &&
          optimizedScenario.monthsToPayoff !== null
            ? simulation.scenarios.base.monthsToPayoff - optimizedScenario.monthsToPayoff
            : null;

        return buildProConversionCopy({
          currentMonths: simulation.scenarios.base.monthsToPayoff,
          currentInterest: simulation.scenarios.base.totalInterest,
          currentTotalPaid: simulation.scenarios.base.totalPaid,
          optimizedMonths: optimizedScenario.monthsToPayoff,
          optimizedInterest: optimizedScenario.totalInterest,
          optimizedTotalPaid: optimizedScenario.totalPaid,
          monthsSaved,
          savings:
            simulation.scenarios.base.feasible && optimizedScenario.feasible
              ? simulation.scenarios.base.totalInterest - optimizedScenario.totalInterest
              : 0,
        });
      })()
    : null;

  useEffect(() => {
    if (!simulation || hasTrackedSimulatorUse.current) {
      return;
    }

    hasTrackedSimulatorUse.current = true;
    trackPlanEvent("simulator_used", {
      membershipTier,
      canCompareScenarios: access.canCompareScenarios,
      totalInterest: simulation.totalInterest,
      monthsToPayoff: simulation.monthsToPayoff,
    });
  }, [access.canCompareScenarios, membershipTier, simulation]);

  useEffect(() => {
    if (!simulation || isPremiumUnlocked || hasTrackedPremiumPreview.current) {
      return;
    }

    hasTrackedPremiumPreview.current = true;
    trackPlanEvent("premium_preview_seen", {
      source: "simulador",
      totalInterest: simulation.totalInterest,
      monthsToPayoff: simulation.monthsToPayoff,
    });
  }, [isPremiumUnlocked, simulation]);

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <ModuleSectionHeader
        kicker="Simulador"
        title="Simula rápido cuánto tardas, cuánto pagas y qué te conviene."
        description="Ajusta el pago, mira el resultado y decide sin ruido."
        action={
          <Button
            className="w-full sm:w-auto"
            variant="secondary"
            onClick={() =>
              debts.length ? setSelectedDebtId(debts[0]?.id ?? "") : form.setFocus("principal")
            }
          >
            {debts.length ? "Cargar una deuda" : "Simular manual"}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full max-w-md gap-1.5 rounded-[1.25rem] border border-border bg-secondary/40 p-1.5 sm:w-auto">
          <Button
            type="button"
            size="sm"
            variant={simulatorViewMode === "portfolio" ? "primary" : "ghost"}
            className="rounded-xl"
            onClick={() => setSimulatorViewMode("portfolio")}
          >
            Toda la cartera
          </Button>
          <Button
            type="button"
            size="sm"
            variant={simulatorViewMode === "single" ? "primary" : "ghost"}
            className="rounded-xl"
            onClick={() => setSimulatorViewMode("single")}
          >
            Una deuda
          </Button>
        </div>
        <p className="text-sm leading-6 text-muted sm:max-w-xl">
          {simulatorViewMode === "portfolio"
            ? "Proyección con el motor del dashboard (estrategia + presupuesto mensual sobre todas las deudas)."
            : "Calculadora rápida por deuda: útil para probar tasas, cuotas y frecuencia sin tocar el resto de la cartera."}
        </p>
      </div>

      {simulatorViewMode === "portfolio" ? (
        <SimulatorPortfolioProjection
          debts={debts}
          preferredStrategy={preferredStrategy}
          conversionSnapshot={_conversionSnapshot ?? null}
          access={access}
          planUpgradeHref={planUpgradeHref}
          onNavigate={navigate}
        />
      ) : (
      <>
      {hasFinancialContext ? (
        <section className="-mx-1 sm:mx-0">
          <div className="rounded-[1.6rem] border border-primary/12 bg-[rgba(240,248,245,0.9)] p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.2rem] border border-white/80 bg-white/88 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Ingreso mensual
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatRoundedCurrency(_conversionSnapshot?.monthlyIncome ?? 0)}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/80 bg-white/88 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Gastos base
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatRoundedCurrency(
                    _conversionSnapshot?.monthlyEssentialExpensesTotal ?? 0,
                  )}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/80 bg-white/88 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Capacidad para deudas
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatRoundedCurrency(_conversionSnapshot?.monthlyDebtCapacity ?? 0)}
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/80 bg-white/88 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Presupuesto registrado
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatRoundedCurrency(_conversionSnapshot?.currentMonthlyBudget ?? 0)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">
              Este contexto sale de tu ingreso y tus gastos base registrados, para que la recomendación no parta a ciegas.
            </p>
          </div>
        </section>
      ) : null}

      <section className="-mx-1 grid gap-3 lg:hidden">
        <div className="rounded-[1.5rem] border border-border bg-white/92 p-4 shadow-soft">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border border-border/70 bg-secondary/45 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Paso 1
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Elige la deuda o simula manual
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-secondary/45 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Paso 2
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Ajusta pago y extra
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-secondary/45 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Paso 3
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                Mira qué opción te conviene
              </p>
            </div>
          </div>
        </div>

        {simulation ? (
          <div className="rounded-[1.5rem] border border-primary/12 bg-[rgba(240,248,245,0.9)] p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.15rem] border border-white/70 bg-white/88 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Tiempo estimado
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {formatMonthsValue(simulation.monthsToPayoff)}
                </p>
              </div>
              <div className="rounded-[1.15rem] border border-white/70 bg-white/88 p-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                  Intereses
                </p>
                <p className="value-stable mt-1 text-base font-semibold text-foreground">
                  {formatSimulationAmount(simulation.totalInterest)}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-[1.15rem] border border-white/70 bg-white/88 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                Te conviene
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
                {!isPremiumUnlocked
                  ? "Desbloquear el mejor escenario"
                  : simulation.savingsWithExtraPayment.interestSaved > 0
                    ? `Subir el pago y recortar ${formatMonthsValue(simulation.savingsWithExtraPayment.monthsSaved)}`
                    : "Probar un pago más alto"}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 sm:gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <Card className="order-1 -mx-1 min-w-0 p-4 sm:mx-0 sm:p-6">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">Se actualiza al instante</Badge>
              <Badge variant="default">{currencyBadgeLabel}</Badge>
            </div>
            <CardTitle className="text-balance">Simulador rápido de deuda</CardTitle>
            <CardDescription className="hidden max-w-2xl text-pretty lg:block">
              Mete el monto, la tasa y tu pago real. En segundos ves cuánto tardas en salir, cuánto pagas en intereses y qué ganas si subes la cuota.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {debts.length ? (
              <div className="space-y-2 rounded-[1.35rem] border border-border bg-secondary/35 p-4 lg:border-0 lg:bg-transparent lg:p-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80 lg:hidden">
                  Paso 1
                </p>
                <Label htmlFor="registeredDebt">Cargar una deuda registrada</Label>
                <select
                  id="registeredDebt"
                  value={selectedDebtId}
                  className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-base leading-tight text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  onChange={(event) => {
                    const nextDebtId = event.target.value;
                    setSelectedDebtId(nextDebtId);

                    if (!nextDebtId) {
                      form.reset(buildManualDefaults());
                      return;
                    }

                    const nextDebt = debts.find((debt) => debt.id === nextDebtId);

                    if (nextDebt) {
                      form.reset(buildDefaultsFromDebt(nextDebt));
                    }
                  }}
                >
                  <option value="">Simulación manual</option>
                  {debts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name}
                    </option>
                  ))}
                </select>
                <p className="hidden text-xs leading-6 text-muted lg:block">
                  Si eliges una deuda guardada, el simulador toma su saldo, tasa y pago mínimo como punto de partida.
                </p>
                {selectedDebt ? (
                  <p className="text-sm text-muted lg:hidden">
                    Base cargada: {selectedDebt.name}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/35 px-4 py-4 text-sm leading-7 text-muted">
                Puedes usar este simulador aunque todavía no tengas deudas guardadas. Solo llena los campos y verás el impacto al instante.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-[1.35rem] border border-border bg-secondary/35 p-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80 lg:hidden">
                  Paso 2
                </p>
                <Label htmlFor="debtType">Tipo de deuda</Label>
                <select
                  id="debtType"
                  className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-base leading-tight text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("debtType", {
                    validate: (value) =>
                      value === "CREDIT_CARD" ||
                      value === "PERSONAL_LOAN" ||
                      value === "FIXED_NO_INTEREST",
                  })}
                >
                  {Object.entries(debtTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="principal">Monto de la deuda</Label>
                <Input
                  id="principal"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("principal", principalValidation)}
                />
                {form.formState.errors.principal?.message ? (
                  <p className="text-xs text-danger">
                    {form.formState.errors.principal.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">Tasa de interés</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  disabled={watchedValues.debtType === "FIXED_NO_INTEREST"}
                  {...form.register("interestRate", interestRateValidation)}
                />
                <p className="hidden text-xs leading-6 text-muted lg:block">
                  {watchedValues.debtType === "FIXED_NO_INTEREST"
                    ? "En cuota fija sin interés la tasa se toma como 0%."
                    : "Introduce la tasa tal como te la informan."}
                </p>
              </div>

              <div className="hidden space-y-2 lg:block">
                <Label htmlFor="interestRateType">Tipo de tasa</Label>
                <select
                  id="interestRateType"
                  className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-base leading-tight text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  disabled={watchedValues.debtType === "FIXED_NO_INTEREST"}
                  {...form.register("interestRateType", {
                    validate: (value) => interestRateTypeOptions.has(value),
                  })}
                >
                  <option value="ANNUAL">Anual</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Pago actual o cuota mínima</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("paymentAmount", paymentAmountValidation)}
                />
                {form.formState.errors.paymentAmount?.message ? (
                  <p className="text-xs text-danger">
                    {form.formState.errors.paymentAmount.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="extraPayment">Pago extra opcional</Label>
                <Input
                  id="extraPayment"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...form.register("extraPayment", extraPaymentValidation)}
                />
                <p className="hidden text-xs leading-6 text-muted lg:block">
                  Si puedes poner algo adicional, aquí ves de inmediato cuánto tiempo e interés recortas.
                </p>
              </div>

              <div className="hidden space-y-2 lg:block">
                <Label htmlFor="paymentFrequency">Frecuencia de pago</Label>
                <select
                  id="paymentFrequency"
                  className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-base leading-tight text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                  {...form.register("paymentFrequency", {
                    validate: (value) => paymentFrequencyOptions.has(value),
                  })}
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="BIWEEKLY">Quincenal</option>
                  <option value="WEEKLY">Semanal</option>
                </select>
              </div>

              <div className="hidden space-y-2 lg:block">
                <Label htmlFor="startDate">Fecha de inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...form.register("startDate", startDateValidation)}
                />
              </div>
            </div>

            <details className="rounded-[1.3rem] border border-border bg-secondary/35 p-4 lg:hidden">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                Ver opciones avanzadas
              </summary>
              <p className="mt-2 text-sm text-muted">
                Ajusta frecuencia, tipo de tasa y fecha solo si necesitas una simulación más precisa.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="interestRateTypeMobile">Tipo de tasa</Label>
                  <select
                    id="interestRateTypeMobile"
                    className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-base leading-tight text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                    disabled={watchedValues.debtType === "FIXED_NO_INTEREST"}
                    {...form.register("interestRateType", {
                      validate: (value) => interestRateTypeOptions.has(value),
                    })}
                  >
                    <option value="ANNUAL">Anual</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentFrequencyMobile">Frecuencia</Label>
                  <select
                    id="paymentFrequencyMobile"
                    className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-base leading-tight text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:text-sm"
                    {...form.register("paymentFrequency", {
                      validate: (value) => paymentFrequencyOptions.has(value),
                    })}
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="BIWEEKLY">Quincenal</option>
                    <option value="WEEKLY">Semanal</option>
                  </select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="startDateMobile">Fecha de inicio</Label>
                  <Input
                    id="startDateMobile"
                    type="date"
                    {...form.register("startDate", startDateValidation)}
                  />
                </div>
              </div>
            </details>

            {fieldErrors.length && !simulation ? (
              <div className="rounded-[1.5rem] border border-danger/20 bg-danger/5 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Completa estos datos para generar la proyección
                </p>
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {fieldErrors.map((error) => (
                    <li key={error} className="break-words">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="order-2 -mx-1 min-w-0 p-4 sm:mx-0 sm:p-6">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="warning">Resultado inmediato</Badge>
              <Badge variant="default">
                {frequencyLabels[watchedValues.paymentFrequency ?? "MONTHLY"]}
              </Badge>
            </div>
            <CardTitle className="text-balance">Qué pasa si mantienes este ritmo</CardTitle>
            <CardDescription className="hidden text-pretty lg:block">
              El resumen principal siempre parte de tu pago actual. Si añades extra, abajo verás cuánto cambia el panorama.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {simulation && resultHeadline ? (
              <>
                <div className="rounded-[1.75rem] border border-primary/12 bg-[rgba(240,248,245,0.92)] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={simulation.scenarios.base.feasible ? "success" : "danger"}>
                      {simulation.scenarios.base.feasible ? "Salida estimada" : "Advertencia"}
                    </Badge>
                    {simulation.savingsWithExtraPayment.monthsSaved &&
                    simulation.savingsWithExtraPayment.monthsSaved > 0 ? (
                      <Badge variant="warning">
                        {formatMonthsValue(simulation.savingsWithExtraPayment.monthsSaved)} menos con extra
                      </Badge>
                    ) : null}
                  </div>
                      <p className="mt-4 text-[clamp(1.4rem,6vw,2.2rem)] font-semibold leading-tight text-foreground">
                        {resultHeadline.title}
                      </p>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                    {resultHeadline.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {simulation.scenarios.base.payoffDate ? (
                      <Badge variant="default">
                        Termina cerca de{" "}
                        <span className="date-stable inline-block">
                          {formatDate(simulation.scenarios.base.payoffDate, "MMM yyyy")}
                        </span>
                      </Badge>
                    ) : null}
                    <Badge variant="default">
                      Pago {frequencyLabels[watchedValues.paymentFrequency ?? "MONTHLY"].toLowerCase()}
                    </Badge>
                  </div>
                  <div className="mt-5 grid gap-3 lg:hidden">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[1.15rem] border border-white/80 bg-white/90 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                          Tiempo
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatMonthsValue(simulation.monthsToPayoff)}
                        </p>
                      </div>
                      <div className="rounded-[1.15rem] border border-white/80 bg-white/90 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                          Intereses
                        </p>
                        <p className="value-stable mt-1 text-base font-semibold text-foreground">
                          {formatSimulationAmount(simulation.totalInterest)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.15rem] border border-white/80 bg-white/90 p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
                        Qué conviene ahora
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-5 text-foreground">
                        {!isPremiumUnlocked
                          ? "Desbloquear la comparación completa"
                          : simulation.savingsWithExtraPayment.interestSaved > 0
                            ? `Subir el pago y ahorrar ${formatSimulationAmount(simulation.savingsWithExtraPayment.interestSaved)}`
                            : "Probar un pago más alto"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 hidden gap-3 sm:gap-4 lg:grid">
                    <div className="rounded-[1.9rem] border border-white/80 bg-white/90 p-4 shadow-[0_14px_32px_rgba(24,49,59,0.06)] sm:p-6">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                        Tiempo estimado
                      </p>
                        <p className="value-stable mt-4 text-[clamp(1.45rem,6vw,2.25rem)] font-semibold text-foreground">
                          {formatMonthsValue(simulation.monthsToPayoff)}
                        </p>
                      <p className="text-muted mt-3 text-sm leading-6">
                        Lo que te tomaría terminar si mantienes este mismo ritmo.
                      </p>
                    </div>
                    {!isPremiumUnlocked ? (
                      <div className="rounded-[1.9rem] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,248,241,0.96),rgba(255,255,255,0.92))] p-4 sm:p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="warning">Este no es el escenario más eficiente</Badge>
                          <Badge variant="default">Podrías salir antes y pagar menos</Badge>
                        </div>
                        <p className="mt-4 text-[clamp(1.05rem,4.6vw,1.2rem)] font-semibold text-foreground">
                          Ya viste el problema. Lo que falta es tu mejor salida.
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted">
                          En Base ves tu ritmo actual. Premium te deja ver cuánto tiempo e interés podrías recuperar con una mejor estrategia.
                        </p>
                      </div>
                    ) : null}
                    <ContextMetricsGrid
                      items={[
                        {
                          label: "Total pagado",
                          value: formatSimulationAmount(simulation.totalPaid),
                          support: "Capital más costo financiero durante todo el período.",
                        },
                        {
                          label: "Estás pagando en intereses",
                          value: formatSimulationAmount(simulation.totalInterest),
                          support: "Esto es lo que se iría solo en financiar la deuda si no cambias la estrategia.",
                        },
                        {
                          label: "Podrías ahorrar",
                          value:
                            access.canSeeOptimizedSavings &&
                            simulation.savingsWithExtraPayment.interestSaved > 0
                              ? formatSimulationAmount(
                                  simulation.savingsWithExtraPayment.interestSaved,
                                )
                              : "Bloqueado en Base",
                          support:
                            access.canSeeOptimizedSavings &&
                            simulation.savingsWithExtraPayment.interestSaved > 0
                              ? `Podrías recortar ${formatMonthsValue(
                                  simulation.savingsWithExtraPayment.monthsSaved,
                                )}.`
                              : UPGRADE_MESSAGES.SIMULATOR_SAVINGS_LOCKED,
                          valueKind:
                            access.canSeeOptimizedSavings &&
                            simulation.savingsWithExtraPayment.interestSaved > 0
                              ? "value"
                              : "text",
                          span: 2,
                        },
                      ]}
                    />
                  </div>
                </div>

                {simulation.warnings.length ? (
                  <details className="rounded-[1.5rem] border border-danger/20 bg-danger/5 p-4 sm:p-5 lg:hidden">
                    <summary className="cursor-pointer list-none font-semibold text-foreground">
                      Revisar advertencias
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-muted">
                      {simulation.warnings.map((warning) => (
                        <li key={warning} className="break-words">
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                {simulation.warnings.length ? (
                  <div className="hidden rounded-[1.5rem] border border-danger/20 bg-danger/5 p-4 sm:p-5 lg:block">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 size-5 text-danger" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          Hay algo que conviene revisar antes de tomar esto como plan.
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-muted">
                          {simulation.warnings.map((warning) => (
                            <li key={warning} className="break-words">
                              • {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
                      <div className="rounded-[1.75rem] border border-dashed border-border bg-secondary/35 p-4 sm:p-5">
                <p className="text-base font-semibold text-foreground">
                  En cuanto completes los datos, aquí verás tu salida estimada.
                </p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  La idea es simple: cuánto tardas en terminar, cuánto se va en intereses y qué ganas si subes el pago.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="rounded-[1.55rem] border border-primary/12 bg-[rgba(240,248,245,0.92)] p-4 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary/80">
              Qué te conviene
            </p>
            <p className="mt-2 text-base font-semibold leading-tight text-foreground">
              {simulatorActionTitle}
            </p>
            <p className="mt-2 text-sm text-muted">
              {simulatorActionDescription}
            </p>
          </div>
          <Badge
            variant={
              !simulation
                ? "default"
                : !isPremiumUnlocked
                  ? "warning"
                  : simulation?.savingsWithExtraPayment.interestSaved &&
                      simulation.savingsWithExtraPayment.interestSaved > 0
                    ? "success"
                    : "default"
            }
          >
            {!simulation
              ? "Pendiente"
              : !isPremiumUnlocked
                ? "Mejorable"
                : "Listo"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            className="w-full"
            onClick={() => {
              if (simulation && !isPremiumUnlocked) {
                trackPlanEvent("upgrade_click", {
                  source: "simulador_primary_action_mobile",
                  targetPlan: highlightedPlanId,
                });
                navigate(planUpgradeHref);
                return;
              }

              if (debts.length) {
                navigate(selectedDebtId ? `/pagos?debtId=${selectedDebtId}` : "/pagos");
                return;
              }

              form.setFocus("paymentAmount");
            }}
          >
            {simulation && !isPremiumUnlocked
              ? "Ver cómo salir antes"
              : debts.length
                ? "Registrar pago"
                : "Ajustar simulación"}
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => navigate(debts.length ? "/deudas" : "/planes")}
          >
            {debts.length ? "Revisar deudas" : "Ver planes"}
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
        <PrimaryActionCard
          eyebrow="Lo que más te conviene hoy"
          title={simulatorActionTitle}
          description={simulatorActionDescription}
          badgeLabel={
            !simulation
              ? "Resultado pendiente"
              : !isPremiumUnlocked
                ? "Este no es tu mejor escenario"
                : simulation?.savingsWithExtraPayment.interestSaved &&
                    simulation.savingsWithExtraPayment.interestSaved > 0
                  ? "Ahorro visible"
                  : simulation?.scenarios.base.feasible
                    ? "Decisión lista"
                    : "Necesita ajuste"
          }
          badgeVariant={
            !simulation
              ? "default"
              : !isPremiumUnlocked
                ? "warning"
                : simulation?.savingsWithExtraPayment.interestSaved &&
                    simulation.savingsWithExtraPayment.interestSaved > 0
                  ? "success"
                  : simulation?.scenarios.base.feasible
                    ? "default"
                    : "danger"
          }
          primaryAction={{
            label:
              simulation && !isPremiumUnlocked
                ? "Ver cómo salir antes"
                : simulation?.savingsWithExtraPayment.interestSaved &&
                    simulation.savingsWithExtraPayment.interestSaved > 0
                  ? "Ver escenario con extra"
                  : "Probar otro pago",
            onClick: () => {
              if (simulation && !isPremiumUnlocked) {
                trackPlanEvent("upgrade_click", {
                  source: "simulador_primary_action",
                  targetPlan: highlightedPlanId,
                });
                navigate(planUpgradeHref);
                return;
              }

              setSelectedScenarioId(
                simulation?.savingsWithExtraPayment.interestSaved &&
                  simulation.savingsWithExtraPayment.interestSaved > 0
                  ? "EXTRA"
                  : "BASE",
              );
              form.setFocus(
                simulation?.savingsWithExtraPayment.interestSaved &&
                  simulation.savingsWithExtraPayment.interestSaved > 0
                  ? "extraPayment"
                  : "paymentAmount",
              );
            },
          }}
          secondaryAction={
            !isPremiumUnlocked
              ? {
                  label: "Ajustar pago",
                  onClick: () => form.setFocus("paymentAmount"),
                  variant: "secondary",
                }
              : undefined
          }
          notes={
            simulation
              ? !isPremiumUnlocked
                ? [
                    `Sales en ${formatMonthsValue(simulation.monthsToPayoff)}.`,
                    `Pagas ${formatSimulationAmount(simulation.totalInterest)} en intereses.`,
                    `Pago ${frequencyLabels[watchedValues.paymentFrequency ?? "MONTHLY"].toLowerCase()}: ${formatSimulationAmount(simulation.scenarios.base.paymentAmount)}.`,
                  ]
                : [
                    `Intereses visibles: ${formatSimulationAmount(simulation.totalInterest)}.`,
                    selectedScenario?.payoffDate
                      ? `Salida cerca de ${formatDate(selectedScenario.payoffDate, "MMM yyyy")}.`
                      : "Todavía no hay fecha clara de salida.",
                  ]
              : [
                  "Usa monto, tasa y pago real para activar la lectura.",
                  "La comparación aparece apenas la simulación sea viable.",
                ]
          }
          tone={
            !simulation
              ? "default"
              : !isPremiumUnlocked
                ? "warning"
                : simulation?.savingsWithExtraPayment.interestSaved &&
                    simulation.savingsWithExtraPayment.interestSaved > 0
                  ? "premium"
                  : simulation?.scenarios.base.feasible
                    ? "default"
                    : "warning"
          }
          icon={Sparkles}
        />
      </div>

      {simulation ? (
        <>
          {isPremiumUnlocked ? (
            <>
              <details className="rounded-[1.5rem] border border-border bg-white/92 p-4 lg:hidden">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  Ver comparación de escenarios
                </summary>
                <p className="mt-2 text-sm text-muted">
                  Aquí ves rápido cuál escenario te deja salir antes y pagar menos.
                </p>
                <div className="mt-4 space-y-3">
                  {comparisonRows.map(({ scenario, delta }) => (
                    <div
                      key={scenario.id}
                      className="rounded-[1.2rem] border border-border/80 bg-secondary/35 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            scenario.id === "BASE"
                              ? "default"
                              : scenario.id === "EXTRA"
                                ? "warning"
                                : "success"
                          }
                        >
                          {scenario.label}
                        </Badge>
                        {scenario.id === bestScenarioId ? (
                          <Badge variant="success">Conviene más</Badge>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {formatMonthsValue(scenario.monthsToPayoff)} · {formatSimulationAmount(scenario.totalInterest)} en intereses
                      </p>
                      {scenario.id !== "BASE" ? (
                        <p className="mt-2 text-sm text-muted">
                          {delta.monthsSaved !== null && delta.monthsSaved > 0
                            ? `${formatMonthsValue(delta.monthsSaved)} menos`
                            : "Sin recorte de tiempo visible"}
                          {" · "}
                          {delta.interestSaved > 0
                            ? `${formatSimulationAmount(delta.interestSaved)} menos en intereses`
                            : "Sin ahorro visible"}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>

              <section className="hidden gap-4 2xl:grid-cols-[1.15fr_0.85fr] lg:grid">
                <Card className="-mx-1 min-w-0 p-4 sm:mx-0 sm:p-6">
                  <CardHeader>
                    <CardTitle className="text-balance">Comparación de escenarios</CardTitle>
                    <CardDescription className="text-pretty">
                      Mira rápido cuánto cambia tu salida entre el pago normal, el pago con extra y una versión más agresiva.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
                    {comparisonRows.map(({ scenario, delta }, index) => {
                      const isSelected = effectiveSelectedScenarioId === scenario.id;
                      const shouldSpanFullWidth =
                        comparisonRows.length % 2 === 1 && index === comparisonRows.length - 1;

                      return (
                        <button
                          key={scenario.id}
                          type="button"
                          className={`min-w-0 rounded-[1.5rem] border p-4 text-left transition-all duration-200 ease-out active:scale-[0.985] sm:p-5 ${
                            isSelected
                              ? "border-primary/24 bg-[rgba(240,248,245,0.94)] shadow-[0_18px_36px_rgba(15,88,74,0.08)] ring-2 ring-primary/10"
                              : "border-border bg-white hover:-translate-y-[1px] hover:border-primary/18 hover:bg-[rgba(255,255,255,0.98)] hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)]"
                          } ${shouldSpanFullWidth ? "md:col-span-2" : ""}`}
                          onClick={() => setSelectedScenarioId(scenario.id)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={
                                scenario.id === "BASE"
                                  ? "default"
                                  : scenario.id === "EXTRA"
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {scenario.label}
                            </Badge>
                            {scenario.id === bestScenarioId ? (
                              <Badge variant="success">Mejor ahorro</Badge>
                            ) : null}
                            {!scenario.feasible ? (
                              <Badge variant="danger">Sin salida</Badge>
                            ) : null}
                          </div>
                          <p className="value-stable mt-4 text-[clamp(1.05rem,3.4vw,1.45rem)] font-semibold leading-tight text-foreground">
                            {formatMonthsValue(scenario.monthsToPayoff)}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-muted">
                            Pago por período: {formatSimulationAmount(scenario.paymentAmount)}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-muted">
                            {getScenarioSupportCopy(scenario.id, extraPaymentValue)}
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[1.2rem] border border-border/70 bg-secondary/35 px-4 py-3 transition-colors duration-200 ease-out">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                                Intereses
                              </p>
                              <p className="value-stable mt-2 text-sm font-semibold text-foreground">
                                {formatSimulationAmount(scenario.totalInterest)}
                              </p>
                            </div>
                            <div className="rounded-[1.2rem] border border-border/70 bg-secondary/35 px-4 py-3 transition-colors duration-200 ease-out">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                                Total pagado
                              </p>
                              <p className="value-stable mt-2 text-sm font-semibold text-foreground">
                                {formatSimulationAmount(scenario.totalPaid)}
                              </p>
                            </div>
                            {scenario.id !== "BASE" ? (
                              <div className="rounded-[1.2rem] border border-primary/12 bg-[rgba(240,248,245,0.92)] px-4 py-3 transition-all duration-200 ease-out sm:col-span-2">
                                <p className="text-foreground text-sm font-semibold">
                                  {delta.monthsSaved !== null && delta.monthsSaved > 0
                                    ? `${formatMonthsValue(delta.monthsSaved)} menos`
                                    : "Sin recorte de tiempo visible"}
                                </p>
                                <p className="text-foreground mt-2 text-sm font-semibold">
                                  {delta.interestSaved > 0
                                    ? `${formatSimulationAmount(delta.interestSaved)} menos en intereses`
                                    : "Sin ahorro de intereses visible"}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="-mx-1 min-w-0 p-4 sm:mx-0 sm:p-6">
                  <CardHeader>
                    <CardTitle>Lectura visual rápida</CardTitle>
                    <CardDescription className="text-pretty">
                      Cuanto más larga la barra, más rápido sales con ese escenario.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {scenarioSummary.map(({ scenario, relativeWidth }) => (
                      <div key={scenario.id} className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-semibold text-foreground">{scenario.label}</p>
                          <p className="text-sm text-muted sm:text-right">
                            {formatMonthsValue(scenario.monthsToPayoff)} · {formatSimulationAmount(scenario.totalInterest)} en intereses
                          </p>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-secondary/60">
                          <div
                            className={`h-full rounded-full ${
                              scenario.id === "BASE"
                                ? "bg-slate-400"
                                : scenario.id === "EXTRA"
                                  ? "bg-amber-400"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: relativeWidth, transition: "width 200ms ease-out" }}
                          />
                        </div>
                      </div>
                    ))}

                    {simulation.savingsWithExtraPayment.interestSaved > 0 ? (
                      <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <Sparkles className="mt-0.5 size-5 text-amber-600" />
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              El pago extra ya tiene impacto real.
                            </p>
                            <p className="mt-2 text-sm leading-7 text-muted">
                              Con ese extra podrías ahorrar {formatSimulationAmount(simulation.savingsWithExtraPayment.interestSaved)}
                              {" "}y salir {formatMonthsValue(simulation.savingsWithExtraPayment.monthsSaved)} antes.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </section>

              {isProUnlocked ? (
                <>
                  <div className="rounded-[1.5rem] border border-primary/14 bg-[rgba(240,248,245,0.92)] p-4 lg:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">Capa Pro</Badge>
                      {simulation.recommendedStrategyLabel ? (
                        <Badge variant="default">{simulation.recommendedStrategyLabel}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-base font-semibold text-foreground">
                      Pro añade una guía más activa sobre qué hacer después.
                    </p>
                    <div className="mt-4 space-y-2">
                      {simulation.proGuidance.stepByStepPlan.slice(0, 2).map((step) => (
                        <div
                          key={step}
                          className="rounded-[1.1rem] border border-white/70 bg-white/88 px-3 py-3 text-sm text-foreground"
                        >
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Card className="-mx-1 hidden min-w-0 border-primary/14 bg-[rgba(240,248,245,0.92)] p-4 sm:mx-0 sm:p-6 lg:block">
                    <CardHeader className="gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="success">Capa Pro</Badge>
                        {simulation.recommendedStrategyLabel ? (
                          <Badge variant="default">
                            {simulation.recommendedStrategyLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <CardTitle>Control total sobre la estrategia</CardTitle>
                      <CardDescription className="text-pretty">
                        Pro añade guía más activa para que la simulación no se quede en un cálculo aislado.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-4 lg:grid-cols-[0.92fr_1.08fr]">
                      <FeaturePreview
                        label="Lectura dinámica"
                        title={
                          simulation.proGuidance.dynamicFocus ??
                          "Tu estrategia puede evolucionar contigo."
                        }
                        description="Cada vez que cambia el flujo, Pro te ayuda a revisar si sigue conviniendo mantener la misma presión."
                      />
                      <div className="rounded-[1.5rem] border border-white/70 bg-white/88 p-4 sm:p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                          Paso a paso sugerido
                        </p>
                        <div className="mt-4 space-y-3">
                          {simulation.proGuidance.stepByStepPlan.map((step) => (
                            <div
                              key={step}
                              className="rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3 text-sm leading-7 text-foreground"
                            >
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : showSimulatorProPrompt ? (
                <>
                  <LockedCard
                    title={proConversionCopy?.paywall.title ?? UPGRADE_MESSAGES.PRO_VALUE}
                    description={
                      proConversionCopy?.paywall.subtitle ??
                      "Premium ya te dice cuál escenario mejora más. Pro añade guía más activa, seguimiento paso a paso y una estrategia que se siente más viva."
                    }
                    requiredPlan="Pro"
                    reason={proConversionCopy?.paywall.note ?? UPGRADE_MESSAGES.PRO_SUPPORT}
                    className="lg:hidden"
                  >
                    <div className="space-y-3">
                      {(proConversionCopy?.paywall.content ?? []).slice(0, 2).map((item) => (
                        <div
                          key={item}
                          className="rounded-[1.1rem] border border-white/70 bg-white/88 px-3 py-3 text-sm font-medium text-foreground"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                    <UpgradeCTA
                      title={proConversionCopy?.cta.primary.text ?? "Activa una estrategia que evolucione contigo"}
                      description={proConversionCopy?.cta.primary.subtext ?? "Añade seguimiento, contexto y una guía más inteligente para no volver a perder tracción."}
                      requiredPlan="Pro"
                      ctaText={proConversionCopy?.cta.secondary.text ?? MEMBERSHIP_COMMERCIAL_COPY.contextualCta.notificationsPro}
                      onClick={() => {
                        trackPlanEvent("upgrade_click", {
                          source: "simulador_pro_teaser_mobile",
                          targetPlan: "PRO",
                        });
                        navigate("/planes?plan=PRO&source=simulador");
                      }}
                    />
                  </LockedCard>

                  <LockedCard
                    title={proConversionCopy?.paywall.title ?? UPGRADE_MESSAGES.PRO_VALUE}
                    description={
                      proConversionCopy?.paywall.subtitle ??
                      "Premium ya te dice cuál escenario mejora más. Pro añade guía más activa, seguimiento paso a paso y una estrategia que se siente más viva."
                    }
                    requiredPlan="Pro"
                    reason={proConversionCopy?.paywall.note ?? UPGRADE_MESSAGES.PRO_SUPPORT}
                    className="hidden lg:block"
                  >
                    {proConversionCopy ? (
                      <div className="space-y-4">
                        <div className="rounded-[1.6rem] border border-white/70 bg-white/88 p-4 sm:p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            {proConversionCopy.microcopy.slice(0, 2).map((item) => (
                              <Badge key={item} variant="warning">
                                {item}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-4 text-2xl font-semibold text-foreground">
                            {proConversionCopy.hero.title}
                          </p>
                          <p className="mt-2 text-sm leading-7 text-muted">
                            {proConversionCopy.hero.subtitle}
                          </p>
                          <p className="mt-3 text-sm font-medium text-primary">
                            {proConversionCopy.hero.highlight}
                          </p>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-[1.5rem] border border-white/70 bg-white/86 p-4 sm:p-5">
                            <p className="text-sm font-semibold text-foreground">
                              {proConversionCopy.painBlock.title}
                            </p>
                            <ul className="mt-4 space-y-2 text-sm leading-7 text-muted">
                              {proConversionCopy.painBlock.bullets.map((bullet) => (
                                <li key={bullet}>{bullet}</li>
                              ))}
                            </ul>
                            <p className="mt-4 text-sm font-medium text-primary">
                              {proConversionCopy.painBlock.warning}
                            </p>
                          </div>

                          <div className="rounded-[1.5rem] border border-white/70 bg-white/86 p-4 sm:p-5">
                            <p className="text-sm font-semibold text-foreground">
                              {proConversionCopy.impact.title}
                            </p>
                            <ul className="mt-4 space-y-2 text-sm leading-7 text-muted">
                              {proConversionCopy.impact.benefits.map((benefit) => (
                                <li key={benefit}>{benefit}</li>
                              ))}
                            </ul>
                            <p className="mt-4 text-sm font-medium text-primary">
                              {proConversionCopy.impact.emotional}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <FeaturePreview
                            title={proConversionCopy.comparison.current.title}
                            description={proConversionCopy.comparison.current.content.join(" · ")}
                            label={proConversionCopy.comparison.current.badges.join(" · ")}
                          />
                          <BlurredInsight
                            title={proConversionCopy.comparison.optimized.title}
                            value={proConversionCopy.comparison.optimized.content[0] ?? "Menos tiempo"}
                            support={`${proConversionCopy.comparison.optimized.content.slice(1).join(" · ")}`}
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          {proConversionCopy.paywall.content.map((item) => (
                            <div
                              key={item}
                              className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm font-medium text-foreground"
                            >
                              {item}
                            </div>
                          ))}
                        </div>

                        <div className="rounded-[1.5rem] border border-primary/12 bg-[rgba(240,248,245,0.9)] px-4 py-4 text-sm font-medium text-foreground">
                          {proConversionCopy.urgency}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-3">
                        <FeaturePreview
                          title="Premium ya resuelve"
                          description="Comparación, pérdida visible y estrategia recomendada."
                        />
                        <BlurredInsight
                          title="Pro agrega"
                          value="Reoptimización dinámica"
                          support="Cuando cambia tu flujo, Pro te ayuda a revisar si sigue conviniendo la misma ruta."
                        />
                        <FeaturePreview
                          title="Resultado"
                          description="No solo ves tus deudas: las controlas con más contexto y seguimiento."
                          label="Capa superior"
                        />
                      </div>
                    )}
                    <div className="grid gap-3 md:grid-cols-3">
                      {PRO_CONVERSION_COPY.microcopy.slice(2).map((item) => (
                        <div
                          key={item}
                          className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm font-medium text-foreground"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                    <UpgradeCTA
                      title={proConversionCopy?.cta.primary.text ?? "Activa una estrategia que evolucione contigo"}
                      description={
                        proConversionCopy
                          ? `${proConversionCopy.cta.primary.subtext}. ${proConversionCopy.cta.secondary.subtext}.`
                          : "Pro está pensado para quien ya usa Premium y quiere una capa más inteligente de seguimiento y estrategia."
                      }
                      requiredPlan="Pro"
                      ctaText={proConversionCopy?.cta.secondary.text ?? MEMBERSHIP_COMMERCIAL_COPY.contextualCta.notificationsPro}
                      onClick={() => {
                        trackPlanEvent("upgrade_click", {
                          source: "simulador_pro_teaser",
                          targetPlan: "PRO",
                        });
                        navigate("/planes?plan=PRO&source=simulador");
                      }}
                    />
                  </LockedCard>
                </>
              ) : null}

              <details className="rounded-[1.5rem] border border-border bg-white/92 p-4 lg:hidden">
                <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                  Ver tabla de pagos
                </summary>
                <p className="mt-2 text-sm text-muted">
                  Úsala si quieres ver cómo se reparte cada pago en el escenario seleccionado.
                </p>
                {selectedScenario?.amortizationSchedule.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted">
                          <th className="px-3 py-2 font-medium">Período</th>
                          <th className="px-3 py-2 font-medium">Pago</th>
                          <th className="px-3 py-2 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedScenario.amortizationSchedule.slice(0, 8).map((row) => (
                          <tr key={`${selectedScenario.id}-${row.period}`} className="border-b border-border/60">
                            <td className="px-3 py-2 text-foreground">{row.period}</td>
                            <td className="value-stable px-3 py-2 text-foreground">{formatSimulationAmount(row.payment)}</td>
                            <td className="value-stable px-3 py-2 text-foreground">{formatSimulationAmount(row.remainingBalance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.2rem] border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted">
                    Cuando la simulación sea viable, aquí verás el reparto básico de pagos.
                  </div>
                )}
              </details>

              <Card className="-mx-1 hidden min-w-0 p-4 sm:mx-0 sm:p-6 lg:block">
                <CardHeader className="gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="default">
                      {selectedScenario ? selectedScenario.label : "Pago normal"}
                    </Badge>
                    {selectedScenario?.payoffDate ? (
                      <Badge variant="success">
                        Termina cerca de{" "}
                        <span className="date-stable inline-block">
                          {formatDate(selectedScenario.payoffDate, "MMM yyyy")}
                        </span>
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-balance">Tabla resumida de amortización</CardTitle>
                  <CardDescription className="text-pretty">
                    Muestra cómo se reparte cada pago entre capital e intereses en el escenario seleccionado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {selectedScenario?.amortizationSchedule.length ? (
                    <details className="rounded-[1.5rem] border border-border bg-secondary/30 p-4 sm:p-5">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                        Ver detalle de pagos
                      </summary>
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-border text-muted">
                              <th className="px-3 py-2 font-medium">Período</th>
                              <th className="px-3 py-2 font-medium">Fecha</th>
                              <th className="px-3 py-2 font-medium">Pago</th>
                              <th className="px-3 py-2 font-medium">Capital</th>
                              <th className="px-3 py-2 font-medium">Interés</th>
                              <th className="px-3 py-2 font-medium">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedScenario.amortizationSchedule.slice(0, 12).map((row) => (
                              <tr key={`${selectedScenario.id}-${row.period}`} className="border-b border-border/60">
                                <td className="px-3 py-2 text-foreground">{row.period}</td>
                                <td className="date-stable px-3 py-2 text-muted">{formatDate(row.date)}</td>
                                <td className="value-stable px-3 py-2 text-foreground">{formatSimulationAmount(row.payment)}</td>
                                <td className="value-stable px-3 py-2 text-foreground">{formatSimulationAmount(row.principalPaid)}</td>
                                <td className="value-stable px-3 py-2 text-muted">{formatSimulationAmount(row.interestPaid)}</td>
                                <td className="value-stable px-3 py-2 text-foreground">{formatSimulationAmount(row.remainingBalance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {selectedScenario.amortizationSchedule.length > 12 ? (
                        <p className="mt-3 text-xs leading-6 text-muted">
                          Se muestran los primeros 12 pagos para mantener la lectura simple. La proyección completa sí se usa para el cálculo final.
                        </p>
                      ) : null}
                    </details>
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/30 p-4 text-sm leading-7 text-muted sm:p-5">
                      Cuando la simulación sea viable, aquí verás cómo se reparte cada pago.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : showSimulatorPremiumPrompt ? (
            <>
            <LockedCard
              className="lg:hidden"
              title={UPGRADE_MESSAGES.SIMULATOR_CURRENT_ONLY}
              description="En Base ves tu realidad actual. Premium te muestra cuánto dinero y tiempo estás perdiendo al seguir así."
              requiredPlan="Premium"
              reason={UPGRADE_MESSAGES.INTEREST_LOSS}
            >
              <div className="grid gap-3">
                <FeaturePreview
                  title="Resultado actual"
                  description={`Sales en ${simulation ? formatMonthsValue(simulation.monthsToPayoff) : "tu ritmo actual"} y pagas ${simulation ? formatSimulationAmount(simulation.totalInterest) : "intereses visibles"}.`}
                />
                <BlurredInsight
                  title="Podrías salir antes"
                  value={lockedMonthsPreview}
                  support={UPGRADE_MESSAGES.SIMULATOR_TIME_LOCKED}
                />
                <BlurredInsight
                  title="Podrías pagar menos"
                  value={lockedSavingsPreview}
                  support={UPGRADE_MESSAGES.SIMULATOR_SAVINGS_LOCKED}
                />
              </div>
              <UpgradeCTA
                title="Ya viste cuánto te cuesta seguir igual"
                description="Premium compara tu ruta actual con una mejor estrategia y te muestra cuánto dinero y tiempo sigues perdiendo."
                requiredPlan="Premium"
                ctaText={MEMBERSHIP_COMMERCIAL_COPY.contextualCta.simulatorPremium}
                onClick={() => {
                  trackPlanEvent("upgrade_click", {
                    source: "simulador_locked_card_mobile",
                    targetPlan: "NORMAL",
                  });
                  navigate(planUpgradeHref);
                }}
              />
            </LockedCard>

            <LockedCard
              className="hidden lg:block"
              title={UPGRADE_MESSAGES.SIMULATOR_CURRENT_ONLY}
              description="En Base ves tu realidad actual y validas si el pago que haces hoy alcanza. Premium te muestra cuánto dinero y tiempo estás perdiendo al seguir así."
              requiredPlan="Premium"
              reason={UPGRADE_MESSAGES.INTEREST_LOSS}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FeaturePreview
                  title="Resultado actual"
                  description={`Sales en ${simulation ? formatMonthsValue(simulation.monthsToPayoff) : "tu ritmo actual"}, pagas ${simulation ? formatSimulationAmount(simulation.totalInterest) : "intereses visibles"} y sostienes ${simulation ? formatSimulationAmount(simulation.scenarios.base.paymentAmount) : "tu pago actual"}.`}
                />
                <BlurredInsight
                  title="Podrías salir antes"
                  value={lockedMonthsPreview}
                  support={UPGRADE_MESSAGES.SIMULATOR_TIME_LOCKED}
                />
                <BlurredInsight
                  title="Hay dinero que podrías dejar de perder"
                  value={lockedSavingsPreview}
                  support={UPGRADE_MESSAGES.SIMULATOR_SAVINGS_LOCKED}
                />
                <FeaturePreview
                  title="Hay una mejor estrategia disponible"
                  description="Premium compara tu ruta actual contra una mejor secuencia y te dice qué decisión te deja de costar más."
                  label="Lo que falta"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {upgradeNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm font-medium text-foreground"
                  >
                    {note}
                  </div>
                ))}
              </div>
              <UpgradeCTA
                title="Ya viste el costo actual. Falta ver la salida que más te conviene"
                description={
                  extraPaymentValue > 0
                    ? `Ya tienes un extra cargado de ${formatSimulationAmount(extraPaymentValue)}. Premium lo compara contra tu pago actual y una ruta mejorada para mostrar cuánto dinero y tiempo sigues perdiendo.`
                    : "Premium te enseña cuánto podrías dejar de perder en tiempo e intereses si ajustas la estrategia."
                }
                requiredPlan="Premium"
                ctaText={MEMBERSHIP_COMMERCIAL_COPY.contextualCta.simulatorPremium}
                onClick={() => {
                  trackPlanEvent("upgrade_click", {
                    source: "simulador_locked_card",
                    targetPlan: "NORMAL",
                  });
                  navigate(planUpgradeHref);
                }}
              />
            </LockedCard>
            </>
          ) : null}

        </>
      ) : null}

      </>
      )}

      <TrustInlineNote
        title="Control sin fricción"
        notes={[
          simulatorViewMode === "portfolio"
            ? "La vista cartera llama al servidor con tus deudas reales; los números respetan tu plan de acceso (Base, Premium o Pro)."
            : "La simulación de una deuda corre en tu navegador al instante.",
          "Tú decides qué datos probar y cuánto explorar.",
          "Premium desbloquea comparaciones más ricas también en la vista de una deuda.",
        ]}
      />
    </div>
  );
}
