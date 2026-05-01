"use client";

import { StrategyMethod } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BlurredInsight } from "@/components/membership/blurred-insight";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEMBERSHIP_COMMERCIAL_COPY } from "@/config/membership-commercial-copy";
import type { ResolvedFeatureAccess } from "@/lib/feature-access";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { trackPlanEvent } from "@/lib/telemetry/plan-events";
import type {
  DebtItemDto,
  MembershipConversionSnapshotDto,
  SimulatorResultDto,
} from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

const strategyLabels: Record<StrategyMethod, string> = {
  SNOWBALL: "Bola de nieve",
  AVALANCHE: "Avalancha",
  HYBRID: "Híbrido",
};

function getDefaultPortfolioBudget(
  debts: DebtItemDto[],
  snapshot: MembershipConversionSnapshotDto | null,
): number {
  if (snapshot && snapshot.currentMonthlyBudget > 0) {
    return Math.round(snapshot.currentMonthlyBudget);
  }

  if (snapshot && snapshot.suggestedMonthlyBudget > 0) {
    return Math.round(snapshot.suggestedMonthlyBudget);
  }

  // Suma mínimos de todas las deudas activas. Si hay DOP y USD, mezclar montos sigue siendo
  // una aproximación (igual que el motor agregado), pero evita arrancar solo con líneas DOP.
  const sum = debts.reduce((acc, debt) => acc + debt.minimumPayment, 0);

  return Math.max(1, Math.round(sum));
}

function formatMonthsLabel(value: number | null) {
  if (value === null) {
    return "Sin salida clara con este presupuesto";
  }

  if (value < 1) {
    return "< 1 mes";
  }

  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${rounded} ${value === 1 ? "mes" : "meses"}`;
}

function parseAnnualRateInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");

  if (!trimmed) {
    return null;
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value) || value < 0 || value > 999) {
    return null;
  }

  return value;
}

function isCreditCardDebt(debt: DebtItemDto) {
  return debt.type === "CREDIT_CARD";
}

/** Evita depender solo de `debts.length`: misma cantidad con otras líneas o montos debe recalcular. */
function buildDebtsProjectionFingerprint(debts: DebtItemDto[]): string {
  if (!debts.length) {
    return "";
  }

  return [...debts]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((debt) =>
      [
        debt.id,
        debt.type,
        debt.status,
        debt.currency,
        debt.currentBalance,
        debt.minimumPayment,
        debt.interestRate,
        debt.interestRateType,
        debt.interestRateMode,
        debt.paymentAmountType,
        debt.lateFeeAmount,
        debt.extraChargesAmount,
        debt.nextDueDate ?? "",
      ].join(":"),
    )
    .join("|");
}

type SimulatorPortfolioProjectionProps = {
  debts: DebtItemDto[];
  preferredStrategy: StrategyMethod;
  conversionSnapshot: MembershipConversionSnapshotDto | null;
  access: ResolvedFeatureAccess;
  planUpgradeHref: string;
  onNavigate: (href: string) => void;
};

export function SimulatorPortfolioProjection({
  debts,
  preferredStrategy,
  conversionSnapshot,
  access,
  planUpgradeHref,
  onNavigate,
}: SimulatorPortfolioProjectionProps) {
  const [strategy, setStrategy] = useState<StrategyMethod>(preferredStrategy);
  const [monthlyBudget, setMonthlyBudget] = useState(() =>
    getDefaultPortfolioBudget(debts, conversionSnapshot),
  );
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState(0);
  const [focusedDebtId, setFocusedDebtId] = useState("");
  const [cardToFreezeId, setCardToFreezeId] = useState("");
  const [monthlyCardUsageToStop, setMonthlyCardUsageToStop] = useState(0);
  const [refinanceDebtId, setRefinanceDebtId] = useState("");
  const [refinancedRateInput, setRefinancedRateInput] = useState("");
  const [result, setResult] = useState<SimulatorResultDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasMixedCurrency = useMemo(
    () => new Set(debts.map((debt) => debt.currency)).size > 1,
    [debts],
  );

  const portfolioDisplayCurrency = useMemo((): DebtItemDto["currency"] => {
    const currencies = new Set(debts.map((debt) => debt.currency));
    if (currencies.size === 1) {
      return debts[0]!.currency;
    }

    return "DOP";
  }, [debts]);

  const creditCardDebts = useMemo(() => debts.filter(isCreditCardDebt), [debts]);

  const debtsProjectionFingerprint = useMemo(
    () => buildDebtsProjectionFingerprint(debts),
    [debts],
  );

  useEffect(() => {
    setStrategy(preferredStrategy);
  }, [preferredStrategy]);

  useEffect(() => {
    setMonthlyBudget(getDefaultPortfolioBudget(debts, conversionSnapshot));
  }, [debts, conversionSnapshot]);

  const runProjection = useCallback(async () => {
    if (!debts.length) {
      setResult(null);
      setError("Agrega al menos una deuda activa para proyectar la cartera.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        strategy,
        monthlyBudget,
      };

      if (access.canUseAdvancedExtraPayments && extraMonthlyPayment > 0) {
        body.extraMonthlyPayment = extraMonthlyPayment;
      }

      if (access.canSeeRecommendedStrategy && focusedDebtId) {
        body.focusedDebtId = focusedDebtId;
      }

      if (access.canSeeOptimizedSavings && cardToFreezeId) {
        body.cardToFreezeId = cardToFreezeId;

        if (monthlyCardUsageToStop > 0) {
          body.monthlyCardUsageToStop = monthlyCardUsageToStop;
        }
      }

      if (access.canSeeRefinanceScenario && refinanceDebtId) {
        const refinancedRate = parseAnnualRateInput(refinancedRateInput);

        if (refinancedRate !== null) {
          body.refinanceDebtId = refinanceDebtId;
          body.refinancedRate = refinancedRate;
        }
      }

      const response = await fetchWithCsrf("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await readJsonPayload<{
        result?: SimulatorResultDto;
        error?: string;
      }>(response);

      if (!response.ok) {
        setResult(null);
        setError(payload.error ?? "No se pudo calcular la proyección.");
        return;
      }

      if (!payload.result) {
        setResult(null);
        setError("Respuesta incompleta del simulador.");
        return;
      }

      setResult(payload.result);
      trackPlanEvent("simulator_portfolio_run", {
        membershipTier: access.requestedTier,
        strategy,
        monthlyBudget,
        extraMonthlyPayment: access.canUseAdvancedExtraPayments ? extraMonthlyPayment : 0,
        hasFocus: Boolean(access.canSeeRecommendedStrategy && focusedDebtId),
        hasFreeze: Boolean(
          access.canSeeOptimizedSavings && cardToFreezeId && monthlyCardUsageToStop > 0,
        ),
        hasRefinance: Boolean(
          access.canSeeRefinanceScenario &&
            refinanceDebtId &&
            parseAnnualRateInput(refinancedRateInput) !== null,
        ),
      });
    } catch {
      setResult(null);
      setError("No se pudo conectar con el simulador. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [
    access.canSeeOptimizedSavings,
    access.canSeeRefinanceScenario,
    access.canSeeRecommendedStrategy,
    access.canUseAdvancedExtraPayments,
    access.requestedTier,
    cardToFreezeId,
    debts.length,
    extraMonthlyPayment,
    focusedDebtId,
    monthlyBudget,
    monthlyCardUsageToStop,
    refinancedRateInput,
    refinanceDebtId,
    strategy,
  ]);

  const runProjectionRef = useRef(runProjection);
  runProjectionRef.current = runProjection;

  useEffect(() => {
    void runProjectionRef.current();
  }, [debtsProjectionFingerprint]);

  if (!debts.length) {
    return (
      <Card className="-mx-1 border-dashed sm:mx-0">
        <CardHeader>
          <CardTitle>Proyección de cartera</CardTitle>
          <CardDescription>
            Esta vista usa el mismo motor que el dashboard: estrategia global, mínimos y tu
            presupuesto mensual repartido entre todas las deudas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-7 text-muted">
          Registra al menos una deuda en{" "}
          <Button
            type="button"
            variant="ghost"
            className="h-auto p-0 text-primary underline"
            onClick={() => onNavigate("/deudas")}
          >
            Deudas
          </Button>{" "}
          para ver meses estimados, intereses totales y la curva de saldo.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {hasMixedCurrency ? (
        <p className="text-sm leading-6 text-muted">
          Tienes deudas en DOP y USD. La proyección agrupa números del motor en una sola línea de
          tiempo; para decisiones finas, revisa cada moneda en la vista de una deuda.
        </p>
      ) : null}

      <Card className="-mx-1 sm:mx-0">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Misma lógica que el dashboard</Badge>
            {!access.canCompareScenarios ? (
              <Badge variant="warning">Vista base · comparación limitada</Badge>
            ) : null}
          </div>
          <CardTitle className="text-balance">Proyección de toda la cartera</CardTitle>
          <CardDescription className="text-pretty">
            Ajusta estrategia y presupuesto mensual total. El servidor aplica bola de nieve,
            avalancha o híbrido sobre tus deudas reales, igual que en el resto de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="portfolio-strategy">Estrategia</Label>
            <select
              id="portfolio-strategy"
              className="min-h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as StrategyMethod)}
            >
              {(Object.keys(strategyLabels) as StrategyMethod[]).map((key) => (
                <option key={key} value={key}>
                  {strategyLabels[key]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio-budget">Presupuesto mensual para deudas</Label>
            <Input
              id="portfolio-budget"
              inputMode="numeric"
              className="min-h-12 rounded-2xl"
              value={Number.isFinite(monthlyBudget) ? String(monthlyBudget) : ""}
              onChange={(event) => {
                const next = Number(event.target.value.replace(/[^\d.]/g, ""));
                setMonthlyBudget(Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0);
              }}
            />
            {conversionSnapshot?.currentMonthlyBudget ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto justify-start p-0 text-xs text-primary underline"
                onClick={() =>
                  setMonthlyBudget(Math.round(conversionSnapshot.currentMonthlyBudget))
                }
              >
                {`Usar presupuesto registrado (${formatCurrency(
                  conversionSnapshot.currentMonthlyBudget,
                  portfolioDisplayCurrency,
                )})`}
              </Button>
            ) : null}
          </div>
          {access.canUseAdvancedExtraPayments ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="portfolio-extra">Extra mensual (opcional)</Label>
              <Input
                id="portfolio-extra"
                inputMode="numeric"
                className="min-h-12 rounded-2xl"
                value={extraMonthlyPayment ? String(extraMonthlyPayment) : ""}
                placeholder="0"
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/[^\d.]/g, ""));
                  setExtraMonthlyPayment(
                    Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0,
                  );
                }}
              />
              <p className="text-xs leading-5 text-muted">
                Suma fija al presupuesto cada mes para ver cuánto bajan meses e intereses.
              </p>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <LockedCard
                title="Comparar con un extra fijo"
                description="Premium desbloquea el extra mensual sobre tu cartera para ver ahorro de interés y meses ganados con el mismo motor."
                requiredPlan="Premium"
                reason="Función de optimización"
              >
                <BlurredInsight title="Meses menos" value="···" support="Disponible en Premium." />
                <UpgradeCTA
                  title="Lleva la proyección al siguiente nivel"
                  description={MEMBERSHIP_COMMERCIAL_COPY.loss.currentVsOptimized}
                  requiredPlan="Premium"
                  ctaText={MEMBERSHIP_COMMERCIAL_COPY.contextualCta.simulatorPremium}
                  onClick={() => {
                    trackPlanEvent("upgrade_click", {
                      source: "simulador_portfolio_extra",
                      targetPlan: "NORMAL",
                    });
                    onNavigate(planUpgradeHref);
                  }}
                />
              </LockedCard>
            </div>
          )}

          {access.canSeeRecommendedStrategy || access.canSeeOptimizedSavings ? (
            <details className="sm:col-span-2 rounded-[1.35rem] border border-border bg-secondary/25 p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-foreground">
                Escenarios opcionales
              </summary>
              <p className="mt-2 text-xs leading-5 text-muted">
                Cada escenario se calcula aparte y se compara con tu plan base. Pulsa «Actualizar
                proyección» cuando cambies algo.
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                {access.canSeeRecommendedStrategy ? (
                  <div className="space-y-2 rounded-[1.15rem] border border-border/60 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      Priorizar una deuda
                    </p>
                    <Label htmlFor="portfolio-focus" className="text-xs">
                      Enviar el extra primero a…
                    </Label>
                    <select
                      id="portfolio-focus"
                      className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      value={focusedDebtId}
                      onChange={(event) => setFocusedDebtId(event.target.value)}
                    >
                      <option value="">Sin prioridad manual</option>
                      {debts.map((debt) => (
                        <option key={debt.id} value={debt.id}>
                          {debt.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] leading-4 text-muted">
                      Útil cuando quieres acelerar una línea concreta sin cambiar el presupuesto
                      total.
                    </p>
                  </div>
                ) : null}

                {access.canSeeOptimizedSavings ? (
                  <div className="space-y-2 rounded-[1.15rem] border border-border/60 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      Dejar de cargar la tarjeta
                    </p>
                    {creditCardDebts.length ? (
                      <>
                        <Label htmlFor="portfolio-freeze-card" className="text-xs">
                          Tarjeta
                        </Label>
                        <select
                          id="portfolio-freeze-card"
                          className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                          value={cardToFreezeId}
                          onChange={(event) => {
                            setCardToFreezeId(event.target.value);
                            setMonthlyCardUsageToStop(0);
                          }}
                        >
                          <option value="">Ninguna</option>
                          {creditCardDebts.map((debt) => (
                            <option key={debt.id} value={debt.id}>
                              {debt.name}
                            </option>
                          ))}
                        </select>
                        <Label htmlFor="portfolio-freeze-spend" className="text-xs">
                          Compra mensual que dejarías de hacer (aprox.)
                        </Label>
                        <Input
                          id="portfolio-freeze-spend"
                          inputMode="numeric"
                          className="min-h-11 rounded-xl"
                          disabled={!cardToFreezeId}
                          value={monthlyCardUsageToStop ? String(monthlyCardUsageToStop) : ""}
                          placeholder="0"
                          onChange={(event) => {
                            const next = Number(event.target.value.replace(/[^\d.]/g, ""));
                            setMonthlyCardUsageToStop(
                              Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0,
                            );
                          }}
                        />
                      </>
                    ) : (
                      <p className="text-xs leading-5 text-muted">
                        No hay tarjetas de crédito en tu lista. Marca una deuda como tarjeta en
                        Deudas para usar este escenario.
                      </p>
                    )}
                  </div>
                ) : null}

                {access.canSeeRefinanceScenario ? (
                  <div className="space-y-2 rounded-[1.15rem] border border-border/60 bg-white/80 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      Refinanciar tasa
                    </p>
                    <Label htmlFor="portfolio-refi-debt" className="text-xs">
                      Deuda
                    </Label>
                    <select
                      id="portfolio-refi-debt"
                      className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                      value={refinanceDebtId}
                      onChange={(event) => setRefinanceDebtId(event.target.value)}
                    >
                      <option value="">Ninguna</option>
                      {debts.map((debt) => (
                        <option key={debt.id} value={debt.id}>
                          {debt.name} ({debt.interestRate}% anual hoy)
                        </option>
                      ))}
                    </select>
                    <Label htmlFor="portfolio-refi-rate" className="text-xs">
                      Nueva tasa anual (%)
                    </Label>
                    <Input
                      id="portfolio-refi-rate"
                      inputMode="decimal"
                      className="min-h-11 rounded-xl"
                      disabled={!refinanceDebtId}
                      value={refinancedRateInput}
                      placeholder="Ej. 28"
                      onChange={(event) => setRefinancedRateInput(event.target.value)}
                    />
                    <p className="text-[11px] leading-4 text-muted">
                      Simula un préstamo o consolidación más barato; no ejecuta ningún cambio en
                      tus datos guardados.
                    </p>
                  </div>
                ) : access.canSeeOptimizedSavings ? (
                  <LockedCard
                    className="rounded-[1.15rem]"
                    title="Refinanciar tasa"
                    description="Compara el impacto de bajar la tasa de una línea con el motor del servidor. En Pro lo tienes junto al resto de escenarios de cartera."
                    requiredPlan="Pro"
                    reason="Escenario avanzado"
                  >
                    <BlurredInsight title="Ahorro vs. plan base" value="···" support="Disponible en Pro." />
                    <UpgradeCTA
                      title="Pasa a Pro para simular refinanciar"
                      description="Mantén foco y tarjeta en Premium; refinanciar en el motor queda como salto claro hacia Pro."
                      requiredPlan="Pro"
                      ctaText="Ver planes Pro"
                      onClick={() => {
                        trackPlanEvent("upgrade_click", {
                          source: "simulador_portfolio_refinance",
                          targetPlan: "PRO",
                        });
                        onNavigate("/planes?plan=PRO&source=simulador_portfolio_refinance");
                      }}
                    />
                  </LockedCard>
                ) : null}
              </div>
            </details>
          ) : (
            <div className="sm:col-span-2">
              <LockedCard
                title="Escenarios de optimización"
                description="Con Premium ves qué pasa si priorizas una deuda, reduces cargos en tarjeta o bajas una tasa. Todo con el mismo motor del servidor."
                requiredPlan="Premium"
                reason="Comparación avanzada"
              >
                <BlurredInsight title="Meses e intereses" value="···" support="Disponible en Premium." />
                <UpgradeCTA
                  title="Desbloquea escenarios sobre tu cartera real"
                  description={MEMBERSHIP_COMMERCIAL_COPY.loss.inefficientPlan}
                  requiredPlan="Premium"
                  ctaText={MEMBERSHIP_COMMERCIAL_COPY.contextualCta.simulatorPremium}
                  onClick={() => {
                    trackPlanEvent("upgrade_click", {
                      source: "simulador_portfolio_scenarios",
                      targetPlan: "NORMAL",
                    });
                    onNavigate(planUpgradeHref);
                  }}
                />
              </LockedCard>
            </div>
          )}

          <div className="sm:col-span-2">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={loading || monthlyBudget <= 0}
              onClick={() => void runProjection()}
            >
              {loading ? "Calculando…" : "Actualizar proyección"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-[1.25rem] border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-foreground">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen del plan base</CardTitle>
              <CardDescription>
                Con {formatCurrency(monthlyBudget, portfolioDisplayCurrency)} al mes y estrategia{" "}
                {strategyLabels[strategy]}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Tiempo estimado
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatMonthsLabel(result.basePlan.monthsToPayoff)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Intereses totales
                </p>
                <p className="value-stable mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(result.basePlan.totalInterest, portfolioDisplayCurrency)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Saldo restante (fin simulación)
                </p>
                <p className="value-stable mt-2 text-lg font-semibold text-foreground">
                  {formatCurrency(result.basePlan.remainingBalance, portfolioDisplayCurrency)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Con extra mensual</CardTitle>
              <CardDescription>
                {access.canUseAdvancedExtraPayments
                  ? extraMonthlyPayment > 0
                    ? `Incluye ${formatCurrency(extraMonthlyPayment, portfolioDisplayCurrency)} adicionales al presupuesto.`
                    : "Sube el extra arriba para comparar."
                  : "Activa Premium para ver esta comparación con el mismo criterio del servidor."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {access.canUseAdvancedExtraPayments && result.extraPaymentPlan.savings !== null ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">Ahorro de intereses</p>
                    <p className="value-stable text-base font-semibold text-emerald-900">
                      {formatCurrency(result.extraPaymentPlan.savings, portfolioDisplayCurrency)}
                    </p>
                  </div>
                  <p className="text-sm text-muted">
                    Plazo con extra:{" "}
                    <span className="font-medium text-foreground">
                      {formatMonthsLabel(result.extraPaymentPlan.monthsToPayoff)}
                    </span>
                    {" · "}
                    Intereses con extra:{" "}
                    <span className="font-medium text-foreground">
                      {formatCurrency(
                        result.extraPaymentPlan.totalInterest,
                        portfolioDisplayCurrency,
                      )}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-sm leading-7 text-muted">
                  En Base igual ves meses e intereses del plan actual. La comparación con extra
                  queda reservada a Premium para alinear valor y costo.
                </p>
              )}
            </CardContent>
          </Card>

          {result && access.canSeeRecommendedStrategy && focusedDebtId ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Prioridad manual</CardTitle>
                <CardDescription>
                  Enviando el extra primero a{" "}
                  <span className="font-medium text-foreground">
                    {debts.find((d) => d.id === focusedDebtId)?.name ?? "la deuda elegida"}
                  </span>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-7 text-muted">
                {result.focusedDebtPlan.savings !== null ? (
                  <>
                    <p>
                      Tiempo estimado:{" "}
                      <span className="font-semibold text-foreground">
                        {formatMonthsLabel(result.focusedDebtPlan.monthsToPayoff)}
                      </span>
                      {" · "}
                      Intereses:{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(
                          result.focusedDebtPlan.totalInterest,
                          portfolioDisplayCurrency,
                        )}
                      </span>
                    </p>
                    <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-foreground">
                      Ahorro de intereses vs. plan base:{" "}
                      <span className="value-stable font-semibold">
                        {formatCurrency(
                          result.focusedDebtPlan.savings,
                          portfolioDisplayCurrency,
                        )}
                      </span>
                    </p>
                  </>
                ) : (
                  <p>
                    Con este presupuesto, priorizar esa deuda no cambia de forma clara la
                    proyección global. Prueba subir el presupuesto o el extra mensual.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {result && access.canSeeOptimizedSavings && cardToFreezeId && monthlyCardUsageToStop > 0 ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Sin nuevas cargas en la tarjeta</CardTitle>
                <CardDescription>
                  Dejando de gastar aprox.{" "}
                  {formatCurrency(monthlyCardUsageToStop, portfolioDisplayCurrency)} al mes en{" "}
                  {debts.find((d) => d.id === cardToFreezeId)?.name ?? "la tarjeta"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-7 text-muted">
                {result.freezeCardPlan.savings !== null ? (
                  <>
                    <p>
                      Tiempo estimado:{" "}
                      <span className="font-semibold text-foreground">
                        {formatMonthsLabel(result.freezeCardPlan.monthsToPayoff)}
                      </span>
                      {" · "}
                      Intereses:{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(
                          result.freezeCardPlan.totalInterest,
                          portfolioDisplayCurrency,
                        )}
                      </span>
                    </p>
                    <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-foreground">
                      Ahorro de intereses vs. plan base:{" "}
                      <span className="value-stable font-semibold">
                        {formatCurrency(
                          result.freezeCardPlan.savings,
                          portfolioDisplayCurrency,
                        )}
                      </span>
                    </p>
                  </>
                ) : (
                  <p>
                    Con estos valores el escenario no mejora de forma sostenible. Revisa el monto
                    de compras mensuales o el presupuesto total.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {result &&
          access.canSeeRefinanceScenario &&
          refinanceDebtId &&
          parseAnnualRateInput(refinancedRateInput) !== null ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Refinanciar tasa</CardTitle>
                <CardDescription>
                  {debts.find((d) => d.id === refinanceDebtId)?.name ?? "Deuda"} a{" "}
                  {parseAnnualRateInput(refinancedRateInput)}% anual (simulado).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-7 text-muted">
                {result.refinancePlan.savings !== null ? (
                  <>
                    <p>
                      Tiempo estimado:{" "}
                      <span className="font-semibold text-foreground">
                        {formatMonthsLabel(result.refinancePlan.monthsToPayoff)}
                      </span>
                      {" · "}
                      Intereses:{" "}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(
                          result.refinancePlan.totalInterest,
                          portfolioDisplayCurrency,
                        )}
                      </span>
                    </p>
                    <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-foreground">
                      Ahorro de intereses vs. plan base:{" "}
                      <span className="value-stable font-semibold">
                        {formatCurrency(
                          result.refinancePlan.savings,
                          portfolioDisplayCurrency,
                        )}
                      </span>
                    </p>
                  </>
                ) : (
                  <p>
                    Con esa tasa el motor no encuentra mejora clara frente al plan base. Prueba
                    otra tasa o otra deuda.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Lectura de la estrategia</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7 text-muted">{result.selectedStrategyExplanation}</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Saldo total proyectado</CardTitle>
              <CardDescription>
                {access.canCompareScenarios
                  ? "Evolución mes a mes del saldo combinado con tu presupuesto."
                  : "Vista corta en Base; Premium amplía la serie completa."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.monthlyProjection.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted">
                        <th className="py-2 pr-4 font-medium">Mes</th>
                        <th className="py-2 font-medium">Saldo total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.monthlyProjection.map((row) => (
                        <tr key={row.month} className="border-b border-border/60">
                          <td className="py-2 pr-4 text-foreground">{row.month}</td>
                          <td className="value-stable py-2 text-foreground">
                            {formatCurrency(row.totalBalance, portfolioDisplayCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted">Sin puntos de proyección para mostrar.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : !error && !loading ? (
        <p className="text-sm text-muted">Generando la primera proyección…</p>
      ) : null}
    </div>
  );
}
