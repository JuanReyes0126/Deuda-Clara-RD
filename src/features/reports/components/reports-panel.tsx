"use client";

import { endOfMonth, startOfMonth, subDays } from "date-fns";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExecutiveSummaryStrip } from "@/components/shared/executive-summary-strip";
import { ModuleSectionHeader } from "@/components/shared/module-section-header";
import { PrimaryActionCard } from "@/components/shared/primary-action-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import type { ReportSummaryDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

function toDateInput(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

const quickRanges = [
  {
    id: "THIS_MONTH",
    label: "Este mes",
    getRange: () => ({
      from: toDateInput(startOfMonth(new Date())),
      to: toDateInput(endOfMonth(new Date())),
    }),
  },
  {
    id: "LAST_30_DAYS",
    label: "Últimos 30 días",
    getRange: () => ({
      from: toDateInput(subDays(new Date(), 29)),
      to: toDateInput(new Date()),
    }),
  },
  {
    id: "LAST_90_DAYS",
    label: "Últimos 90 días",
    getRange: () => ({
      from: toDateInput(subDays(new Date(), 89)),
      to: toDateInput(new Date()),
    }),
  },
] as const;

async function fetchSummary(from: string, to: string) {
  const response = await fetch(`/api/reports/summary?from=${from}&to=${to}`);
  const payload = await readJsonPayload<{
    error?: string;
    summary?: ReportSummaryDto;
  }>(response);

  if (!response.ok || !payload.summary) {
    throw new Error(payload.error ?? "No se pudo generar el reporte.");
  }

  return payload.summary;
}

function getReportStatus(summary: ReportSummaryDto) {
  if (summary.paymentCount === 0) {
    return {
      badgeVariant: "default" as const,
      badgeLabel: "Activación pendiente",
      title: "Todavía no hay suficiente movimiento para leer progreso real.",
      description:
        "En cuanto registres pagos en este rango, el reporte empieza a decirte si el flujo mejora, se estanca o se sigue yendo demasiado a intereses.",
    };
  }

  if (summary.comparison.signal === "IMPROVING") {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "Vas mejorando",
      title: "Este período rindió mejor que el anterior.",
      description:
        "Hay señales claras de mejor calidad en tu flujo. Ahora conviene sostener la prioridad y no repartir el excedente sin plan.",
    };
  }

  if (summary.comparison.signal === "REGRESSION") {
    return {
      badgeVariant: "danger" as const,
      badgeLabel: "Riesgo de estancarte",
      title: "Tu dinero está rindiendo peor que en el período anterior.",
      description:
        "Aquí conviene reaccionar rápido para que el siguiente mes no vuelva a diluirse en intereses o pagos sin tracción.",
    };
  }

  if (summary.comparison.signal === "STABLE") {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Ritmo estable",
      title: "No estás cayendo, pero todavía falta un salto claro.",
      description:
        "El comportamiento es consistente, aunque todavía hay margen para que más dinero llegue a capital real.",
    };
  }

  const badgeVariant: "success" | "warning" =
    summary.progressSignal === "STRONG" ? "success" : "warning";

  return {
    badgeVariant,
    badgeLabel: summary.progressSignal === "STRONG" ? "Buen ritmo" : "Atención",
    title: summary.coachingHeadline,
    description: summary.coachingSummary,
  };
}

function getReportMilestones(summary: ReportSummaryDto) {
  return [
    {
      label: "Primer pago en rango",
      complete: summary.paymentCount > 0,
      detail: "Activa lectura real del mes.",
    },
    {
      label: "Capital ganando terreno",
      complete: summary.principalSharePct >= 50,
      detail: `${summary.principalSharePct}% de lo pagado fue a principal.`,
    },
    {
      label: "Mejora frente al período anterior",
      complete: summary.comparison.signal === "IMPROVING",
      detail:
        summary.comparison.signal === "NO_BASELINE"
          ? "Aun falta historial comparable."
          : summary.comparison.headline,
    },
  ];
}

function getReportPremiumUpsell(summary: ReportSummaryDto) {
  const feesAndInterest = summary.totalInterestPaid + summary.totalFeesPaid;

  if (summary.paymentCount === 0) {
    return {
      title:
        "Premium cobra más sentido cuando ya empieces a registrar pagos reales.",
      description:
        "En cuanto tengas movimiento, este bloque te dice si tu dinero está bajando capital o si se sigue yendo demasiado a intereses.",
    };
  }

  if (summary.comparison.signal === "REGRESSION") {
    return {
      title: `Este período ya dejó ${formatCurrency(feesAndInterest)} en intereses y cargos.`,
      description:
        "Premium te ayuda a leer si el flujo empeoró y qué deuda conviene corregir primero para que el próximo mes no rinda menos.",
    };
  }

  if (summary.interestAndFeesSharePct >= 45) {
    return {
      title: `Todavía ${summary.interestAndFeesSharePct}% de lo pagado se está yendo en intereses y cargos.`,
      description:
        "Aquí Premium agrega valor porque convierte ese desgaste en una prioridad más clara y una lectura más accionable del período.",
    };
  }

  if (summary.comparison.signal === "IMPROVING") {
    return {
      title: "Ya vas mejorando. Premium sirve para que no pierdas ese avance.",
      description:
        "Además de mostrar el progreso, te ayuda a sostener la mezcla correcta entre principal, alertas y prioridad de pago.",
    };
  }

  return {
    title: "Tu estructura ya tiene suficiente movimiento para pedir una lectura más precisa.",
    description:
      "Premium convierte este reporte en una decisión concreta: te dice dónde seguir, dónde corregir y si el dinero realmente está rindiendo mejor.",
  };
}

function getDebtTypeLabel(type: string) {
  switch (type) {
    case "CREDIT_CARD":
      return "Tarjeta de crédito";
    case "PERSONAL_LOAN":
      return "Préstamo personal";
    case "VEHICLE":
      return "Vehículo";
    case "MORTGAGE":
      return "Hipoteca";
    case "INFORMAL":
      return "Préstamo informal";
    default:
      return "Otra deuda";
  }
}

export function ReportsPanel({
  initialSummary,
  premiumInsightsEnabled = false,
}: {
  initialSummary: ReportSummaryDto;
  premiumInsightsEnabled?: boolean;
}) {
  const { navigate } = useAppNavigation();
  const [summary, setSummary] = useState(initialSummary);
  const [from, setFrom] = useState(initialSummary.from.slice(0, 10));
  const [to, setTo] = useState(initialSummary.to.slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const hasPayments = summary.paymentCount > 0;
  const principalShare = summary.principalSharePct;
  const feesAndInterest = summary.totalInterestPaid + summary.totalFeesPaid;
  const topDebt = summary.debtSummary[0] ?? null;
  const reportStatus = getReportStatus(summary);
  const reportMilestones = getReportMilestones(summary);
  const premiumUpsell = getReportPremiumUpsell(summary);
  const topCategory = useMemo(
    () =>
      [...summary.categorySummary].sort(
        (left, right) => right.totalPaid - left.totalPaid,
      )[0] ?? null,
    [summary.categorySummary],
  );
  const premiumPlanHref = "/planes?plan=NORMAL&source=reportes";
  const reportAction =
    summary.paymentCount === 0
      ? {
          label: "Registrar pago",
          href: "/pagos",
        }
      : summary.comparison.signal === "REGRESSION"
        ? {
            label: "Corregir en simulador",
            href: "/simulador",
          }
        : premiumInsightsEnabled
          ? {
              label: "Revisar mi plan",
              href: "/dashboard?focus=optimization",
            }
          : {
          label: "Desbloquear Premium",
          href: premiumPlanHref,
        };
  const reportSummaryItems = [
    {
      label: "Pagado total",
      value: formatCurrency(summary.totalPaid),
      support: hasPayments
        ? "Todo lo que moviste en este rango, incluyendo capital y costo financiero."
        : "Todavía no hay pagos en este período.",
      featured: true,
      badgeLabel: hasPayments ? "Período activo" : "Sin movimiento",
      badgeVariant: hasPayments ? ("success" as const) : ("default" as const),
    },
    {
      label: "A principal",
      value: formatCurrency(summary.totalPrincipalPaid),
      support: "Lo que de verdad bajó capital.",
    },
    {
      label: "Intereses y cargos",
      value: formatCurrency(feesAndInterest),
      support: "Lo que se quedó en costo financiero.",
    },
    {
      label: "Tu siguiente mejor paso",
      value: reportAction.label,
      support: summary.recommendedNextStep,
      valueKind: "text" as const,
    },
  ];

  const reload = () => {
    if (from > to) {
      toast.error("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    startTransition(async () => {
      try {
        const nextSummary = await fetchSummary(from, to);
        setSummary(nextSummary);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cargar el reporte.",
        );
      }
    });
  };

  const query = new URLSearchParams({ from, to }).toString();

  return (
    <div className="flex flex-col gap-6">
      <ModuleSectionHeader
        kicker="Reportes"
        title="Lee rápido cómo rindió tu dinero y qué conviene ajustar ahora."
        description="Primero ves el resultado del período. Luego una sola recomendación útil. Los filtros quedan aparte para no mezclar lectura con configuración."
        action={
          <Button className="w-full sm:w-auto" onClick={() => navigate(reportAction.href)}>
            {reportAction.label}
          </Button>
        }
      />

      <ExecutiveSummaryStrip items={reportSummaryItems} />

      <PrimaryActionCard
        eyebrow="Así vas este mes"
        title={reportStatus.title}
        description={summary.recommendedNextStep}
        badgeLabel={reportStatus.badgeLabel}
        badgeVariant={reportStatus.badgeVariant}
        primaryAction={{
          label: reportAction.label,
          onClick: () => navigate(reportAction.href),
        }}
        secondaryAction={{
          label: "Registrar avance",
          onClick: () => navigate("/pagos"),
          variant: "secondary",
        }}
        notes={[
          hasPayments
            ? `${summary.principalSharePct}% de lo pagado fue a capital.`
            : "Todavía no hay pagos dentro del rango.",
          summary.comparison.headline,
        ]}
        tone={
          summary.comparison.signal === "REGRESSION"
            ? "warning"
            : summary.comparison.signal === "IMPROVING"
              ? "premium"
              : "default"
        }
      />

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Filtros y exportación</CardTitle>
          <CardDescription>
            Ajusta el rango, actualiza la lectura y exporta cuando quieras compartir o revisar con más calma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="flex flex-wrap gap-2">
            {quickRanges.map((range) => (
              <Button
                key={range.id}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  const nextRange = range.getRange();
                  setFrom(nextRange.from);
                  setTo(nextRange.to);
                }}
              >
                {range.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 rounded-[1.6rem] border border-border/70 bg-secondary/25 p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:max-w-[32rem]">
              <div className="space-y-2">
                <Label htmlFor="from">Desde</Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">Hasta</Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                className="w-full sm:w-auto"
                onClick={reload}
                disabled={isPending}
              >
                {isPending ? "Actualizando..." : "Actualizar"}
              </Button>
              <a className="w-full sm:w-auto" href={`/api/reports/export/csv?${query}`}>
                <Button className="w-full sm:w-auto" variant="secondary">
                  Exportar CSV
                </Button>
              </a>
              <a className="w-full sm:w-auto" href={`/api/reports/export/pdf?${query}`}>
                <Button className="w-full sm:w-auto" variant="secondary">
                  Exportar PDF
                </Button>
              </a>
            </div>
          </div>

          <div className="grid gap-5 2xl:grid-cols-[1.14fr_0.86fr]">
            <div className="border-primary/10 rounded-[1.75rem] border bg-[rgba(240,248,245,0.9)] p-5">
              <div className="grid gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={reportStatus.badgeVariant}>
                      {reportStatus.badgeLabel}
                    </Badge>
                    <Badge variant="default">
                      {hasPayments
                        ? `${principalShare}% a principal`
                        : "Sin pagos en rango"}
                    </Badge>
                  </div>
                  <p className="text-foreground mt-4 text-2xl font-semibold">
                    {reportStatus.title}
                  </p>
                  <p className="text-muted mt-3 text-sm leading-7">
                    {reportStatus.description}
                  </p>
                  <p className="text-muted mt-3 text-sm leading-7">
                    {hasPayments
                      ? `Entre ${formatDate(summary.from)} y ${formatDate(summary.to)} registraste ${summary.paymentCount} pagos. ${feesAndInterest > 0 ? `${formatCurrency(feesAndInterest)} se fue en intereses y cargos.` : "Todo lo registrado fue a principal."}`
                      : "Cambia el rango o registra tu primer pago para empezar a construir reportes útiles y exportables."}
                  </p>
                  {hasPayments ? (
                    <div className="mt-4 rounded-3xl border border-white/70 bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-4 text-xs tracking-[0.16em] uppercase">
                        <p className="text-muted">A principal</p>
                        <p className="text-muted">
                          Intereses y cargos
                        </p>
                      </div>
                      <div className="bg-secondary mt-3 flex h-3 overflow-hidden rounded-full">
                        <div
                          className="bg-[linear-gradient(135deg,#0f584a_0%,#218471_100%)]"
                          style={{ width: `${summary.principalSharePct}%` }}
                        />
                        <div
                          className="bg-[linear-gradient(135deg,#f08a5d_0%,#f4b07a_100%)]"
                          style={{
                            width: `${Math.max(0, 100 - summary.principalSharePct)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4 text-sm">
                        <p className="text-foreground font-semibold">
                          {summary.principalSharePct}% a capital real
                        </p>
                        <p className="text-muted">
                          {summary.interestAndFeesSharePct}% se quedó en costo
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-3xl border border-white/70 bg-white/82 p-4">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Pagos registrados
                    </p>
                    <p className="text-foreground mt-2 text-xl font-semibold">
                      {summary.paymentCount}
                    </p>
                  </div>
                  {topDebt ? (
                    <div className="rounded-3xl border border-white/70 bg-white/82 p-4">
                      <p className="text-muted text-xs tracking-[0.16em] uppercase">
                        Mayor flujo
                      </p>
                      <p className="text-foreground mt-2 text-sm font-semibold leading-6">
                        {topDebt.debtName}
                      </p>
                    </div>
                  ) : null}
                  {topCategory ? (
                    <div className="rounded-3xl border border-white/70 bg-white/82 p-4">
                      <p className="text-muted text-xs tracking-[0.16em] uppercase">
                        Categoría líder
                      </p>
                      <p className="text-foreground mt-2 text-sm font-semibold leading-6">
                        {getDebtTypeLabel(topCategory.type)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-primary/12 rounded-[1.75rem] border bg-[rgba(255,248,241,0.86)] p-5">
              <p className="section-kicker">
                Hitos del período
              </p>
              <p className="text-foreground mt-3 text-xl font-semibold">
                {summary.comparison.headline}
              </p>
              <p className="support-copy mt-2">
                {summary.recommendedNextStep}
              </p>
              <div className="mt-5 grid gap-4">
                {reportMilestones.map((milestone) => (
                  <div
                    key={milestone.label}
                    className="rounded-3xl border border-white/70 bg-white/85 p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-foreground text-sm font-semibold">
                        {milestone.label}
                      </p>
                      <Badge
                        variant={milestone.complete ? "success" : "default"}
                      >
                        {milestone.complete ? "Listo" : "Pendiente"}
                      </Badge>
                    </div>
                    <p className="support-copy mt-2">
                      {milestone.detail}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => navigate(reportAction.href)}
                >
                  {reportAction.label}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => navigate("/pagos")}
                >
                  Registrar avance
                </Button>
              </div>
            </div>
          </div>

          {premiumInsightsEnabled ? (
            <div className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
              <div className="border-primary/15 rounded-[1.75rem] border bg-[rgba(255,248,241,0.82)] p-5">
                <div className="grid gap-5">
                  <div className="min-w-0">
                    <p className="section-kicker">
                      Lectura premium del período
                    </p>
                    <p className="text-foreground mt-3 text-2xl font-semibold">
                      {summary.coachingHeadline}
                    </p>
                    <p className="support-copy mt-3">
                      {summary.coachingSummary}
                    </p>
                    <p className="mt-3 text-sm leading-7 font-semibold text-foreground">
                      Siguiente paso: {summary.recommendedNextStep}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/70 bg-white/82 p-4">
                      <p className="text-muted text-xs tracking-[0.16em] uppercase">
                        Estado del período
                      </p>
                      <p className="text-foreground mt-2 text-sm font-semibold leading-6">
                        {summary.progressSignal === "STRONG"
                          ? "Buen ritmo"
                          : summary.progressSignal === "WATCH"
                            ? "Atención"
                            : "Sin actividad"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/70 bg-white/82 p-4">
                      <p className="text-muted text-xs tracking-[0.16em] uppercase">
                        Principal
                      </p>
                      <p className="text-foreground mt-2 text-lg font-semibold">
                        {summary.principalSharePct}%
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/70 bg-white/82 p-4 sm:col-span-2">
                      <p className="text-muted text-xs tracking-[0.16em] uppercase">
                        Intereses y cargos
                      </p>
                      <p className="text-foreground mt-2 text-lg font-semibold">
                        {summary.interestAndFeesSharePct}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-primary/12 rounded-[1.75rem] border bg-[rgba(240,248,245,0.92)] p-5">
                <p className="section-kicker">
                  Comparado con el período anterior
                </p>
                <p className="text-foreground mt-3 text-2xl font-semibold">
                  {summary.comparison.headline}
                </p>
                <p className="support-copy mt-3">
                  {summary.comparison.summary}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Estado comparativo
                    </p>
                    <p className="text-foreground mt-2 text-sm font-semibold leading-6">
                      {summary.comparison.signal === "IMPROVING"
                        ? "Mejorando"
                        : summary.comparison.signal === "REGRESSION"
                          ? "Retrocediendo"
                          : summary.comparison.signal === "STABLE"
                            ? "Estable"
                            : "Sin historial"}
                    </p>
                  </div>
                  {summary.comparison.previousPrincipalSharePct !== null ? (
                    <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                      <p className="text-muted text-xs tracking-[0.16em] uppercase">
                        Principal antes
                      </p>
                      <p className="text-foreground mt-2 text-sm font-semibold leading-6">
                        {summary.comparison.previousPrincipalSharePct}%
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="text-foreground mt-4 rounded-3xl border border-white/70 bg-white/80 p-5 text-sm leading-7">
                  Usa esta comparación para saber si el plan está ganando
                  calidad o si se está estancando aunque sigas pagando.
                </div>
              </div>
            </div>
          ) : (
            <div className="border-primary/20 rounded-[1.75rem] border border-dashed bg-[rgba(255,248,241,0.82)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-5xl">
                  <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                    Insight premium bloqueado
                  </p>
                  <p className="text-foreground mt-3 text-2xl font-semibold">
                    {premiumUpsell.title}
                  </p>
                  <p className="text-muted mt-3 text-sm leading-7">
                    {premiumUpsell.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {hasPayments ? (
                      <Badge variant="warning">
                        {summary.interestAndFeesSharePct}% en intereses y cargos
                      </Badge>
                    ) : null}
                    {summary.comparison.signal !== "NO_BASELINE" ? (
                      <Badge
                        variant={
                          summary.comparison.signal === "IMPROVING"
                            ? "success"
                            : summary.comparison.signal === "REGRESSION"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {summary.comparison.signal === "IMPROVING"
                          ? "Mejorando"
                          : summary.comparison.signal === "REGRESSION"
                            ? "Retrocediendo"
                            : "Ritmo estable"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => navigate(premiumPlanHref)}
                  >
                    Desbloquear Premium
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/dashboard")}
                  >
                    Ver mi dashboard
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Resumen por deuda</CardTitle>
            <CardDescription>
              Qué cuentas se llevaron la mayor parte del flujo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {summary.debtSummary.length ? (
              summary.debtSummary.map((row) => (
                <div
                  key={row.debtId}
                  className="border-border bg-secondary/70 grid min-w-0 gap-4 rounded-[1.75rem] border p-5 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-foreground min-w-0 font-semibold">
                      {row.debtName}
                    </p>
                    <p className="text-muted mt-1 text-sm leading-6">
                      Flujo aplicado en este período.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-3 sm:text-right">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Pagado
                    </p>
                    <p className="value-stable text-foreground mt-2 text-sm font-semibold">
                      {formatCurrency(row.totalPaid)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-border rounded-3xl border border-dashed p-8 text-center">
                <p className="text-foreground text-base font-semibold">
                  Todavía no hay pagos en este rango.
                </p>
                <p className="text-muted mt-2 text-sm">
                  Cuando registres pagos, aquí verás cuáles deudas se están
                  llevando más flujo.
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => navigate("/pagos")}
                  >
                    Ir a pagos
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>Resumen por categoría</CardTitle>
            <CardDescription>Distribución por tipo de deuda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {summary.categorySummary.length ? (
              summary.categorySummary.map((row) => (
                <div
                  key={row.type}
                  className="border-border bg-secondary/70 grid min-w-0 gap-4 rounded-[1.75rem] border p-5 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-foreground min-w-0 font-semibold">
                      {getDebtTypeLabel(row.type)}
                    </p>
                    <p className="text-muted mt-1 text-sm leading-6">
                      Distribución por tipo de deuda.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-3 sm:text-right">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Pagado
                    </p>
                    <p className="value-stable text-foreground mt-2 text-sm font-semibold">
                      {formatCurrency(row.totalPaid)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-border text-muted rounded-3xl border border-dashed p-8 text-center text-sm">
                Aún no hay suficiente actividad en este período para mostrar
                categorías.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
