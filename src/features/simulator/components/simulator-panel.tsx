"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { type FieldErrors, useForm, useWatch } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  hasMembershipAccess,
  membershipPlanCatalog,
  type MembershipBillingStatus,
  type MembershipPlanId,
} from "@/lib/membership/plans";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
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
import { debtSimulatorFormSchema } from "@/lib/validations/simulator";

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

const currencyFormatter = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatSimulatorCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
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

function requiredNumberValue(value: string) {
  return value === "" ? 0 : Number(value);
}

function optionalNumberValue(value: string) {
  return value === "" ? undefined : Number(value);
}

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

function getResultHeadline(result: DebtSimulationResult) {
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
      )} en intereses frente a tu pago actual.`,
    };
  }

  return {
    title: `Con tu pago actual saldrías en ${formatMonthsValue(result.monthsToPayoff)}.`,
    description: `Mantener ese ritmo te llevaría a pagar ${formatSimulatorCurrency(
      result.totalInterest,
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

function getUpgradeNarrative(input: {
  result: DebtSimulationResult;
  conversionSnapshot: MembershipConversionSnapshotDto | null;
  highlightedPlan: (typeof membershipPlanCatalog)[MembershipPlanId];
}) {
  const base = input.result.scenarios.base;
  const extra = input.result.scenarios.extra;
  const delta = getScenarioDelta(base, extra);

  if (delta.interestSaved > 0) {
    return {
      eyebrow: "Lleva esta mejora a tu plan real",
      title: `Ya viste una mejora concreta: ${formatSimulatorCurrency(
        delta.interestSaved,
      )} menos en intereses.`,
      description: `${input.highlightedPlan.label} toma esa señal y la convierte en prioridad real dentro de tus deudas registradas, con seguimiento claro y orden optimizado.`,
    };
  }

  if (input.conversionSnapshot?.monthsSaved) {
    return {
      eyebrow: "Todavía hay tiempo por recuperar",
      title: `En tus deudas reales podrías recortar ${formatMonthsValue(
        input.conversionSnapshot.monthsSaved,
      )}.`,
      description:
        "El simulador te ayuda a entender una deuda. Premium lo convierte en una ruta completa para que todo tu flujo rinda mejor.",
    };
  }

  return {
    eyebrow: "Convierte el cálculo en decisión",
    title: `${input.highlightedPlan.label} baja esta lógica a tu caso completo.`,
    description:
      "Aquí ves cuánto cambia una deuda. El plan premium te dice cómo repartir el esfuerzo entre todas para salir antes.",
  };
}

export function SimulatorPanel({
  debts,
  conversionSnapshot = null,
  membershipTier,
  billingStatus,
}: {
  debts: DebtItemDto[];
  conversionSnapshot?: MembershipConversionSnapshotDto | null;
  membershipTier: MembershipPlanId;
  billingStatus: MembershipBillingStatus;
}) {
  const { navigate } = useAppNavigation();
  const initialDebt = debts[0] ?? null;
  const [selectedDebtId, setSelectedDebtId] = useState(initialDebt?.id ?? "");
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<DebtSimulatorScenarioId>("EXTRA");
  const highlightedPlanId: MembershipPlanId =
    membershipTier === "PRO" ? "PRO" : "NORMAL";
  const highlightedPlan = membershipPlanCatalog[highlightedPlanId];
  const isPremiumUnlocked = hasMembershipAccess(membershipTier, billingStatus);
  const planUpgradeHref = `/planes?plan=${highlightedPlanId}&source=simulador`;

  const form = useForm<SimulatorFormValues>({
    resolver: zodResolver(debtSimulatorFormSchema) as never,
    mode: "onChange",
    defaultValues: initialDebt ? buildDefaultsFromDebt(initialDebt) : buildManualDefaults(),
  });

  const watchedValues = useWatch({
    control: form.control,
  });
  const deferredValues = useDeferredValue(watchedValues);

  const parsedSimulationInput = useMemo(() => {
    return debtSimulatorFormSchema.safeParse({
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
          })
        : null,
    [parsedSimulationInput],
  );

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
  const resultHeadline = simulation ? getResultHeadline(simulation) : null;
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

  const upgradeNarrative = simulation
    ? getUpgradeNarrative({
        result: simulation,
        conversionSnapshot,
        highlightedPlan,
      })
    : null;
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

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="grid gap-6">
        <Card className="order-1 min-w-0 p-4 sm:p-6">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">Se actualiza al instante</Badge>
              <Badge variant="default">Formato RD$</Badge>
            </div>
            <CardTitle className="text-balance">Simulador rápido de deuda</CardTitle>
            <CardDescription className="max-w-2xl text-pretty">
              Mete el monto, la tasa y tu pago real. En segundos ves cuánto tardas en salir, cuánto pagas en intereses y qué ganas si subes la cuota.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {debts.length ? (
              <div className="space-y-2">
                <Label htmlFor="registeredDebt">Cargar una deuda registrada</Label>
                <select
                  id="registeredDebt"
                  value={selectedDebtId}
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
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
                <p className="text-xs leading-6 text-muted">
                  Si eliges una deuda guardada, el simulador toma su saldo, tasa y pago mínimo como punto de partida.
                </p>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/35 px-4 py-4 text-sm leading-7 text-muted">
                Puedes usar este simulador aunque todavía no tengas deudas guardadas. Solo llena los campos y verás el impacto al instante.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="debtType">Tipo de deuda</Label>
                <select
                  id="debtType"
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  {...form.register("debtType")}
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
                  {...form.register("principal", {
                    setValueAs: requiredNumberValue,
                  })}
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
                  {...form.register("interestRate", {
                    setValueAs: requiredNumberValue,
                  })}
                />
                <p className="text-xs leading-6 text-muted">
                  {watchedValues.debtType === "FIXED_NO_INTEREST"
                    ? "En cuota fija sin interés la tasa se toma como 0%."
                    : "Introduce la tasa tal como te la informan."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRateType">Tipo de tasa</Label>
                <select
                  id="interestRateType"
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  disabled={watchedValues.debtType === "FIXED_NO_INTEREST"}
                  {...form.register("interestRateType")}
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
                  {...form.register("paymentAmount", {
                    setValueAs: requiredNumberValue,
                  })}
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
                  {...form.register("extraPayment", {
                    setValueAs: optionalNumberValue,
                  })}
                />
                <p className="text-xs leading-6 text-muted">
                  Si puedes poner algo adicional, aquí ves de inmediato cuánto tiempo e interés recortas.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentFrequency">Frecuencia de pago</Label>
                <select
                  id="paymentFrequency"
                  className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  {...form.register("paymentFrequency")}
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="BIWEEKLY">Quincenal</option>
                  <option value="WEEKLY">Semanal</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha de inicio</Label>
                <Input id="startDate" type="date" {...form.register("startDate")} />
              </div>
            </div>

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

        <Card className="order-2 min-w-0 p-4 sm:p-6">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="warning">Resultado inmediato</Badge>
              <Badge variant="default">
                {frequencyLabels[watchedValues.paymentFrequency ?? "MONTHLY"]}
              </Badge>
            </div>
            <CardTitle className="text-balance">Qué pasa si mantienes este ritmo</CardTitle>
            <CardDescription className="text-pretty">
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
                  <p className="mt-4 text-[clamp(1.55rem,5vw,2.2rem)] font-semibold leading-tight text-foreground">
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
                  <div className="mt-5 grid gap-4">
                    <div className="rounded-[1.9rem] border border-white/80 bg-white/90 p-5 shadow-[0_14px_32px_rgba(24,49,59,0.06)] sm:p-6">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                        Tiempo estimado
                      </p>
                      <p className="value-stable mt-4 text-[clamp(1.6rem,4vw,2.25rem)] font-semibold text-foreground">
                        {formatMonthsValue(simulation.monthsToPayoff)}
                      </p>
                      <p className="text-muted mt-3 text-sm leading-6">
                        Lo que te tomaría terminar si mantienes este mismo ritmo.
                      </p>
                    </div>
                    <div className="grid gap-4 2xl:grid-cols-2">
                      <div className="rounded-[1.8rem] border border-white/80 bg-white/88 p-5 shadow-[0_12px_28px_rgba(24,49,59,0.06)] sm:p-6">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                          Total pagado
                        </p>
                        <p className="value-stable mt-4 text-[clamp(1.3rem,3vw,1.75rem)] font-semibold text-foreground">
                          {formatSimulatorCurrency(simulation.totalPaid)}
                        </p>
                        <p className="text-muted mt-3 text-sm leading-6">
                          Capital más costo financiero durante todo el período.
                        </p>
                      </div>
                      <div className="rounded-[1.8rem] border border-white/80 bg-white/88 p-5 shadow-[0_12px_28px_rgba(24,49,59,0.06)] sm:p-6">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                          Intereses
                        </p>
                        <p className="value-stable mt-4 text-[clamp(1.3rem,3vw,1.75rem)] font-semibold text-foreground">
                          {formatSimulatorCurrency(simulation.totalInterest)}
                        </p>
                        <p className="text-muted mt-3 text-sm leading-6">
                          Lo que se iría solo en financiar la deuda.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {simulation.warnings.length ? (
                  <div className="rounded-[1.5rem] border border-danger/20 bg-danger/5 p-4 sm:p-5">
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
                  <div className="rounded-[1.75rem] border border-dashed border-border bg-secondary/35 p-5">
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

      {simulation ? (
        <>
          <section className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="min-w-0 p-4 sm:p-6">
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
                      className={`min-w-0 rounded-[1.5rem] border p-4 text-left transition sm:p-5 ${
                        isSelected
                          ? "border-primary/25 bg-[rgba(240,248,245,0.92)] shadow-[0_16px_36px_rgba(15,88,74,0.08)]"
                          : "border-border bg-white hover:border-primary/15"
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
                        Pago por período: {formatSimulatorCurrency(scenario.paymentAmount)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {getScenarioSupportCopy(scenario.id, extraPaymentValue)}
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.2rem] border border-border/70 bg-secondary/35 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                            Intereses
                          </p>
                          <p className="value-stable mt-2 text-sm font-semibold text-foreground">
                            {formatSimulatorCurrency(scenario.totalInterest)}
                          </p>
                        </div>
                        <div className="rounded-[1.2rem] border border-border/70 bg-secondary/35 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                            Total pagado
                          </p>
                          <p className="value-stable mt-2 text-sm font-semibold text-foreground">
                            {formatSimulatorCurrency(scenario.totalPaid)}
                          </p>
                        </div>
                        {scenario.id !== "BASE" ? (
                          <div className="rounded-[1.2rem] border border-primary/12 bg-[rgba(240,248,245,0.92)] px-4 py-3 sm:col-span-2">
                            <p className="text-foreground text-sm font-semibold">
                              {delta.monthsSaved !== null && delta.monthsSaved > 0
                                ? `${formatMonthsValue(delta.monthsSaved)} menos`
                                : "Sin recorte de tiempo visible"}
                            </p>
                            <p className="text-foreground mt-2 text-sm font-semibold">
                              {delta.interestSaved > 0
                                ? `${formatSimulatorCurrency(delta.interestSaved)} menos en intereses`
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

            <Card className="min-w-0 p-4 sm:p-6">
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
                        {formatMonthsValue(scenario.monthsToPayoff)} · {formatSimulatorCurrency(scenario.totalInterest)} en intereses
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
                        style={{ width: relativeWidth }}
                      />
                    </div>
                  </div>
                ))}

                {simulation.savingsWithExtraPayment.interestSaved > 0 ? (
                  <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 size-5 text-amber-600" />
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          El pago extra ya tiene impacto real.
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted">
                          Con ese extra podrías ahorrar {formatSimulatorCurrency(simulation.savingsWithExtraPayment.interestSaved)}
                          {" "}y salir {formatMonthsValue(simulation.savingsWithExtraPayment.monthsSaved)} antes.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

            <Card className="min-w-0 p-4 sm:p-6">
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
                            <td className="value-stable px-3 py-2 text-foreground">{formatSimulatorCurrency(row.payment)}</td>
                            <td className="value-stable px-3 py-2 text-foreground">{formatSimulatorCurrency(row.principalPaid)}</td>
                            <td className="value-stable px-3 py-2 text-muted">{formatSimulatorCurrency(row.interestPaid)}</td>
                            <td className="value-stable px-3 py-2 text-foreground">{formatSimulatorCurrency(row.remainingBalance)}</td>
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
                <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/30 p-5 text-sm leading-7 text-muted">
                  Cuando la simulación sea viable, aquí verás cómo se reparte cada pago.
                </div>
              )}
            </CardContent>
          </Card>

          {!isPremiumUnlocked && upgradeNarrative ? (
            <Card className="min-w-0 border-primary/15 bg-[rgba(240,248,245,0.9)] p-4 sm:p-6">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="warning">{upgradeNarrative.eyebrow}</Badge>
                  <Badge variant="default">
                    {highlightedPlan.label} US${highlightedPlan.monthlyPriceUsd}/mes
                  </Badge>
                </div>
                <CardTitle>{upgradeNarrative.title}</CardTitle>
                <CardDescription>{upgradeNarrative.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button className="w-full sm:w-auto" onClick={() => navigate(planUpgradeHref)}>
                  Ver {highlightedPlan.label}
                </Button>
                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => navigate("/dashboard")}>
                  Volver al dashboard
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
