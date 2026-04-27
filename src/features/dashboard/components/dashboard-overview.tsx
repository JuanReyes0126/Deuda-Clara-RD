"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  CircleDollarSign,
  CreditCard,
  Crown,
  LockKeyhole,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ExecutiveSummaryStrip,
  type ExecutiveSummaryItem,
} from "@/components/shared/executive-summary-strip";
import { ModuleSectionHeader } from "@/components/shared/module-section-header";
import { NarrativeInsightCard } from "@/components/shared/narrative-insight-card";
import { PrimaryActionCard } from "@/components/shared/primary-action-card";
import { TrustInlineNote } from "@/components/shared/trust-inline-note";
import {
  MEMBERSHIP_COMMERCIAL_COPY,
  getCommercialUpgradeCta,
} from "@/config/membership-commercial-copy";
import { UPGRADE_MESSAGES } from "@/config/upgrade-messages";
import { useSessionUpgradePrompt } from "@/lib/membership/use-session-upgrade-prompt";
import { DailyMissionCard } from "./daily-mission-card";
import { DashboardAssistantChat } from "./dashboard-assistant-chat";
import type {
  DashboardDto,
  DashboardPlanSnapshotDto,
  MembershipConversionSnapshotDto,
} from "@/lib/types/app";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { trackPlanEvent } from "@/lib/telemetry/plan-events";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatRelativeDistance } from "@/lib/utils/date";

function ChartLoadingPlaceholder() {
  return (
    <div className="bg-secondary/35 flex h-full flex-col justify-end rounded-3xl p-6">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-full bg-white/80" />
        <div className="grid grid-cols-5 items-end gap-3">
          <div className="h-16 rounded-2xl bg-white/75" />
          <div className="h-24 rounded-2xl bg-white/80" />
          <div className="h-20 rounded-2xl bg-white/75" />
          <div className="h-32 rounded-2xl bg-white/85" />
          <div className="h-28 rounded-2xl bg-white/75" />
        </div>
      </div>
    </div>
  );
}

const DashboardBalanceHistoryChart = dynamic(
  () =>
    import("./dashboard-balance-history-chart").then(
      (module) => module.DashboardBalanceHistoryChart,
    ),
  {
    loading: () => <ChartLoadingPlaceholder />,
  },
);

const DashboardDebtBreakdownChart = dynamic(
  () =>
    import("./dashboard-debt-breakdown-chart").then(
      (module) => module.DashboardDebtBreakdownChart,
    ),
  {
    loading: () => <ChartLoadingPlaceholder />,
  },
);

const statCards = [
  {
    key: "totalDebt",
    label: "Deuda total real",
    icon: CircleDollarSign,
    description: "Incluye saldo, mora y cargos adicionales.",
  },
  {
    key: "totalMinimumPayment",
    label: "Pago mínimo del mes",
    icon: CalendarClock,
    description: "Lo que necesitas cubrir para mantenerte al día.",
  },
  {
    key: "estimatedMonthlyInterest",
    label: "Interés estimado del mes",
    icon: AlertTriangle,
    description: "Lo que te cuesta seguir cargando esta estructura.",
  },
  {
    key: "interestSavings",
    label: "Ahorro potencial",
    icon: Sparkles,
    description: "Lo que podrías ahorrar con el plan recomendado.",
  },
] as const;

const planReasonLabels: Record<string, string> = {
  budget_below_minimum:
    "El presupuesto actual no cubre los mínimos necesarios.",
  non_amortizing: "A este ritmo, la deuda no baja de forma sostenible.",
  max_months_reached: "La proyección supera el horizonte razonable de cálculo.",
};

const premiumActivationStorageKey = "deuda-clara-rd-premium-activation";
const premiumActivationWindowMs = 5 * 60 * 1000;

type PremiumActivationState = {
  startedAt: number;
  completed: string[];
};

type RecommendedDebtPriorityItem = DashboardDto["recommendedOrder"][number];

type DashboardOverviewProps = {
  data: DashboardDto;
  conversionSnapshot?: MembershipConversionSnapshotDto | null;
  premiumWelcome?: boolean;
  initialShowOptimization?: boolean;
  /** Clave para persistir el chat de Clara en este dispositivo (p. ej. id de usuario). */
  claraStorageKey?: string;
};

function formatMonthsLabel(months: number | null) {
  if (months === null) {
    return "Sin salida clara";
  }

  if (months === 0) {
    return "Sin deuda activa";
  }

  return `${months} ${months === 1 ? "mes" : "meses"}`;
}

function getPlanSupportText(plan: DashboardPlanSnapshotDto) {
  if (!plan.feasible) {
    return plan.reason
      ? planReasonLabels[plan.reason]
      : "Faltan datos para proyectar esta ruta.";
  }

  if (plan.monthsToDebtFree === 0) {
    return "No quedan saldos activos pendientes.";
  }

  return `Presupuesto mensual estimado: ${formatCurrency(plan.monthlyBudget)}`;
}

function getPriorityReasonMeta({
  data,
  item,
}: {
  data: DashboardDto;
  item: RecommendedDebtPriorityItem;
}) {
  const dueSoonDebt = data.dueSoonDebts.find((debt) => debt.id === item.id);
  const isUrgentDebt = data.urgentDebt?.id === item.id;

  if (isUrgentDebt && data.urgentDebt?.status === "LATE") {
    return {
      badgeVariant: "danger" as const,
      badgeLabel: "Evita más mora",
      support:
        "Ya viene atrasada. Frenarla primero evita que siga absorbiendo flujo con cargos y presión extra.",
    };
  }

  if (dueSoonDebt?.nextDueDate) {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Vencimiento primero",
      support: `Está demasiado cerca del corte. Si la cubres antes de ${formatRelativeDistance(dueSoonDebt.nextDueDate)}, mantienes el resto del plan respirando.`,
    };
  }

  if (item.monthlyRatePct >= 4) {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Sube al frente por tasa alta",
      support:
        "Está consumiendo más interés que el resto. Cada semana que se queda atrás le cuesta más a tu flujo.",
    };
  }

  if (item.monthlyRatePct >= 2) {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Está consumiendo más interés",
      support:
        "Aunque no esté vencida, esta deuda ya compite fuerte por el dinero del mes y conviene concentrar el excedente aquí.",
    };
  }

  return {
    badgeVariant: "default" as const,
    badgeLabel: "Compite por el mismo flujo",
    support:
      "Hoy rinde más poner el excedente aquí que repartirlo. Así el plan gana tracción más rápido.",
  };
}

function readPremiumActivationState() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(premiumActivationStorageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PremiumActivationState;

    if (!parsed.startedAt || !Array.isArray(parsed.completed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function persistPremiumActivationState(
  nextState: PremiumActivationState | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!nextState) {
    window.localStorage.removeItem(premiumActivationStorageKey);
    return;
  }

  window.localStorage.setItem(
    premiumActivationStorageKey,
    JSON.stringify(nextState),
  );
}

function getLockedUpgradeContext({
  data,
  conversionSnapshot,
}: {
  data: DashboardDto;
  conversionSnapshot: MembershipConversionSnapshotDto | null;
}) {
  if (!conversionSnapshot?.hasDebts) {
    return {
      eyebrow: "Desbloqueo premium",
      title: "Primero necesitamos una deuda activa para optimizar de verdad.",
      description:
        "En cuanto registres una deuda, Premium podrá comparar tu ritmo actual contra una salida más rápida y convertirlo en un plan accionable.",
      primaryCtaLabel: "Ir a deudas",
      primaryHref: "/deudas",
      secondaryCtaLabel: "Ver planes",
      secondaryHref: "/planes?plan=NORMAL&source=dashboard",
      badges: [],
    };
  }

  const monthsSaved = conversionSnapshot.monthsSaved;
  const interestSavings = conversionSnapshot.interestSavings;
  const badges = [
    monthsSaved !== null && monthsSaved > 0
      ? `${monthsSaved} meses menos`
      : null,
    interestSavings !== null && interestSavings > 0
      ? `${formatCurrency(interestSavings)} evitables`
      : null,
    conversionSnapshot.urgentDebtName
      ? `Prioridad: ${conversionSnapshot.urgentDebtName}`
      : null,
  ].filter(Boolean) as string[];

  if (
    conversionSnapshot.riskAlertCount > 0 &&
    conversionSnapshot.dueSoonCount > 0
  ) {
    return {
      eyebrow: "Presión detectada",
      title:
        "Ya tienes intereses caros y vencimientos compitiendo por tu flujo.",
      description: `Hoy mismo tienes ${conversionSnapshot.riskAlertCount} alerta${
        conversionSnapshot.riskAlertCount === 1 ? "" : "s"
      } de riesgo y ${conversionSnapshot.dueSoonCount} vencimiento${
        conversionSnapshot.dueSoonCount === 1 ? "" : "s"
      } cercano${conversionSnapshot.dueSoonCount === 1 ? "" : "s"}. Premium te devuelve una sola prioridad clara para que no sigas decidiendo a ciegas.`,
      primaryCtaLabel: "Desbloquear prioridad",
      primaryHref: "/planes?plan=NORMAL&source=dashboard",
      secondaryCtaLabel: "Ver alertas",
      secondaryHref: "/notificaciones",
      badges,
    };
  }

  if (monthsSaved !== null && monthsSaved > 0) {
    return {
      eyebrow: "Tiempo recuperable",
      title: `Tu ritmo actual podría recortarse en ${monthsSaved} ${
        monthsSaved === 1 ? "mes" : "meses"
      }.`,
      description: `${conversionSnapshot.immediateAction} Premium toma esa oportunidad y la convierte en una ruta clara para los próximos 6 meses, sin tener que comparar escenarios manualmente.`,
      primaryCtaLabel: "Ver cómo salir antes",
      primaryHref: "/planes?plan=NORMAL&source=dashboard",
      secondaryCtaLabel: "Abrir simulador",
      secondaryHref: "/simulador",
      badges,
    };
  }

  if (data.summary.estimatedMonthlyInterest > 0) {
    return {
      eyebrow: "Costo mensual visible",
      title: `Ahora mismo estás cargando ${formatCurrency(data.summary.estimatedMonthlyInterest)} al mes en intereses estimados.`,
      description:
        "El módulo premium no solo te muestra el problema: te dice qué deuda atacar primero, con qué presupuesto, y qué tanto recortas si sostienes el plan recomendado.",
      primaryCtaLabel: "Desbloquear mi mejor estrategia",
      primaryHref: "/planes?plan=NORMAL&source=dashboard",
      secondaryCtaLabel: "Revisar deudas",
      secondaryHref: "/deudas",
      badges,
    };
  }

  return {
    eyebrow: "Desbloqueo premium",
    title:
      "Ya tienes suficiente información para pasar de control a estrategia.",
    description:
      "Premium convierte tus deudas actuales en un orden de pago optimizado, con ahorro estimado, horizonte de salida y una guía más clara para sostener el plan.",
    primaryCtaLabel: "Desbloquear mi mejor estrategia",
    primaryHref: "/planes?plan=NORMAL&source=dashboard",
    secondaryCtaLabel: "Abrir simulador",
    secondaryHref: "/simulador",
    badges,
  };
}

function getMomentumSummary({
  data,
  isPremiumUnlocked,
}: {
  data: DashboardDto;
  isPremiumUnlocked: boolean;
}) {
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round(data.summary.paidVsPendingPercentage)),
  );

  if (data.summary.totalDebt <= 0) {
    return {
      badgeVariant: "default" as const,
      badgeLabel: "Pendiente de activar",
      title: "Primero necesitamos una deuda para construir progreso real.",
      description:
        "En cuanto registres tu primera deuda, este bloque te mostrará avance, hitos y señales de ritmo.",
      progressLabel: "Sin progreso medible todavía",
    };
  }

  if (data.urgentDebt?.status === "LATE") {
    return {
      badgeVariant: "danger" as const,
      badgeLabel: "Riesgo de estancarte",
      title: "Hay presión real sobre tu flujo y conviene corregirla hoy.",
      description:
        "Tienes al menos una deuda atrasada. Resolver ese frente primero vale más que repartir dinero sin prioridad.",
      progressLabel: `${progressPct}% del camino visible entre pagado y pendiente`,
    };
  }

  if (data.riskAlerts.length > 0) {
    return {
      badgeVariant: "warning" as const,
      badgeLabel: "Ritmo bajo presión",
      title: "Todavía estás pagando, pero parte del flujo se sigue diluyendo.",
      description:
        "Las alertas de pago mínimo indican que el dinero no está bajando capital tan rápido como debería.",
      progressLabel: `${progressPct}% de avance visible`,
    };
  }

  if (data.recentPayments.length === 0) {
    return {
      badgeVariant: "default" as const,
      badgeLabel: "Primer avance pendiente",
      title: "Ya hay deudas cargadas. Falta convertir eso en movimiento.",
      description:
        "El siguiente salto es registrar el primer pago para que el sistema pueda medir si tu plan empieza a rendir mejor.",
      progressLabel: `${progressPct}% del recorrido registrado`,
    };
  }

  if (isPremiumUnlocked && (data.planComparison?.monthsSaved ?? 0) > 0) {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "Vas mejorando",
      title: "Tu estructura ya muestra una salida más eficiente que la actual.",
      description: data.planComparison?.interestSavings
        ? `El plan premium detecta ${formatCurrency(data.planComparison.interestSavings)} evitables y una ruta más corta si sostienes la prioridad.`
        : "La prioridad actual ya está trabajando a favor de una salida más corta.",
      progressLabel: `${progressPct}% de avance visible con ruta optimizada`,
    };
  }

  if (progressPct >= 35) {
    return {
      badgeVariant: "success" as const,
      badgeLabel: "Primer avance importante",
      title: "Ya hay suficiente movimiento para que el plan se sienta real.",
      description:
        "Todavía queda camino, pero tu historial ya muestra señales claras de avance y mejor lectura del flujo.",
      progressLabel: `${progressPct}% de avance visible`,
    };
  }

  return {
    badgeVariant: "warning" as const,
    badgeLabel: "Ritmo estable",
    title: "La base ya está montada; ahora toca sostener una sola prioridad.",
    description:
      "No parece haber una caída fuerte, pero todavía hay espacio para que el dinero rinda mejor y la salida se acorte.",
    progressLabel: `${progressPct}% del recorrido registrado`,
  };
}

function getProgressMilestones({
  data,
  isPremiumUnlocked,
}: {
  data: DashboardDto;
  isPremiumUnlocked: boolean;
}) {
  return [
    {
      label: "Primera deuda",
      complete: data.summary.totalDebt > 0,
      detail: "Ya hay base para proyectar.",
    },
    {
      label: "Primer pago",
      complete: data.recentPayments.length > 0,
      detail: "Activa lectura real del avance.",
    },
    {
      label: "Prioridad visible",
      complete: Boolean(data.summary.recommendedDebtName || data.urgentDebt),
      detail: "Ya sabes qué deuda mirar primero.",
    },
    {
      label: "Plan premium",
      complete: isPremiumUnlocked,
      detail: "Desbloquea ahorro y orden optimizado.",
    },
  ];
}

export function DashboardOverview({
  data,
  conversionSnapshot = null,
  premiumWelcome = false,
  initialShowOptimization = false,
  claraStorageKey = "local-clara",
}: DashboardOverviewProps) {
  const { navigate } = useAppNavigation();
  const navigateTo = (path: string) => navigate(path);
  const [chartsReady, setChartsReady] = useState(false);
  const [showOptimization, setShowOptimization] = useState(
    initialShowOptimization,
  );
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(premiumWelcome);
  const [activationCompletedSteps, setActivationCompletedSteps] = useState<
    string[]
  >([]);
  const [activationRemainingMs, setActivationRemainingMs] = useState(0);
  const optimizationRef = useRef<HTMLElement | null>(null);
  const isPremiumUnlocked =
    data.membership.recommendationUnlocked && data.planComparison !== null;
  const managePlanHref = `/planes?plan=${data.membership.tier === "PRO" ? "PRO" : "NORMAL"}&source=dashboard`;
  const upgradePlanHref = "/planes?plan=NORMAL&source=dashboard";
  const currentPlan = data.planComparison?.currentPlan ?? null;
  const optimizedPlan = data.planComparison?.optimizedPlan ?? null;
  const premiumMonthsSaved = data.planComparison?.monthsSaved ?? null;
  const lockedUpgradeContext = getLockedUpgradeContext({
    data,
    conversionSnapshot,
  });
  const preferredActionDebtId =
    data.summary.recommendedDebtId ??
    data.urgentDebt?.id ??
    data.dueSoonDebts[0]?.id ??
    null;
  const paymentPriorityHref = preferredActionDebtId
    ? `/pagos?debtId=${preferredActionDebtId}&from=dashboard`
    : "/pagos?from=dashboard";
  const momentumSummary = getMomentumSummary({
    data,
    isPremiumUnlocked,
  });
  const progressMilestones = getProgressMilestones({
    data,
    isPremiumUnlocked,
  });
  const debtProgressPct = Math.max(
    0,
    Math.min(100, Math.round(data.summary.paidVsPendingPercentage)),
  );
  const premiumConversionMessage = !isPremiumUnlocked
    ? conversionSnapshot?.monthsSaved && conversionSnapshot.monthsSaved > 0
      ? `Podrías recortar ${conversionSnapshot.monthsSaved} ${conversionSnapshot.monthsSaved === 1 ? "mes" : "meses"} con una mejor prioridad.`
      : data.summary.estimatedMonthlyInterest > 0
        ? `Estás perdiendo ${formatCurrency(data.summary.estimatedMonthlyInterest)} en intereses este mes.`
        : "Tu estructura actual todavía no está bien optimizada."
    : null;
  const hasDebts = data.summary.totalDebt > 0;
  const dashboardPromptIntent = !isPremiumUnlocked
    ? data.analysisScope.partialAnalysis
      ? "partial"
      : hasDebts && data.summary.estimatedMonthlyInterest > 0
        ? "interest"
        : data.riskAlerts.length > 0
          ? "risk"
          : null
    : null;
  const showDashboardPremiumPrompt = useSessionUpgradePrompt({
    id: `dashboard:${dashboardPromptIntent ?? "idle"}`,
    active: Boolean(dashboardPromptIntent),
  });
  const hasHistory = data.balanceHistory.length > 0;
  const hasBreakdown = data.debtBreakdown.length > 0;
  const hasRecommendedOrder = data.recommendedOrder.length > 0;
  const needsBillingAttention =
    data.membership.billingStatus === "PAST_DUE" ||
    data.membership.cancelAtPeriodEnd;
  const isProUnlocked =
    data.membership.tier === "PRO" && data.membership.billingStatus === "ACTIVE";
  const nextTimelineItem = data.upcomingTimeline.items[0] ?? null;
  const mobileRiskLabel =
    data.riskAlerts.length > 0
      ? `${data.riskAlerts.length} alerta${data.riskAlerts.length === 1 ? "" : "s"}`
      : formatCurrency(data.summary.estimatedMonthlyInterest);
  const mobileRiskSupport =
    data.riskAlerts.length > 0
      ? "Requiere atención hoy"
      : "Interés del mes";
  const mobileProgressLabel = data.summary.projectedDebtFreeDate
    ? `Salida estimada: ${formatDate(data.summary.projectedDebtFreeDate, "MMM yyyy")}`
    : formatMonthsLabel(data.summary.monthsToDebtFree);
  const mobileActionButtons = [
    {
      label: "Registrar pago",
      href: paymentPriorityHref,
      variant: "primary" as const,
    },
    {
      label: "Ver deudas",
      href: "/deudas",
      variant: "secondary" as const,
    },
    {
      label: "Abrir simulador",
      href: "/simulador",
      variant: "secondary" as const,
    },
  ];
  const quickActions = [
    !hasDebts
      ? {
          title: "Carga tu primera deuda",
          description:
            "Sin deudas registradas todavía no podemos construir una ruta real ni alertarte a tiempo.",
          actionLabel: "Ir a deudas",
          href: "/deudas",
          icon: CreditCard,
        }
      : null,
    hasDebts && data.recentPayments.length === 0
      ? {
          title: "Registra tu primer pago",
          description:
            "Con un pago registrado el sistema ya empieza a medir avance real y presión mensual.",
          actionLabel: "Ir a pagos",
          href: "/pagos",
          icon: Wallet,
        }
      : null,
    !isPremiumUnlocked && data.membership.billingStatus === "FREE"
      ? {
          title: "Desbloquea el plan recomendado",
          description:
            "Premium te guía por 6 meses para dejar de perder dinero y mostrar cuánto tiempo podrías recortar.",
          actionLabel: getCommercialUpgradeCta("Premium"),
          href: upgradePlanHref,
          icon: Crown,
        }
      : null,
    data.membership.billingStatus === "PAST_DUE"
      ? {
          title: "Tu plan premium necesita atención",
          description:
            "Actualiza la facturación para no perder el módulo recomendado ni el seguimiento.",
          actionLabel: "Revisar facturación",
          href: managePlanHref,
          icon: AlertTriangle,
        }
      : null,
    data.membership.cancelAtPeriodEnd
      ? {
          title: "Tu plan terminará al cierre del período",
          description:
            "Si quieres mantener la guía premium y el orden optimizado, reactívalo antes del corte.",
          actionLabel: "Gestionar plan",
          href: managePlanHref,
          icon: CircleCheck,
        }
      : null,
    hasDebts && data.riskAlerts.length > 0
      ? {
          title: "Hay señales de pago mínimo riesgoso",
          description:
            "Revisar esto ahora puede evitar que sigas pagando intereses sin bajar el saldo.",
          actionLabel: "Revisar deudas",
          href: "/deudas",
          icon: Sparkles,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    icon: typeof AlertTriangle;
  }>;
  const secondaryQuickActions = quickActions.slice(0, 2);
  const priorityOne =
    data.recommendedOrder.find((item) => item.priorityRank === 1) ?? null;
  const remainingRecommendedOrder = priorityOne
    ? data.recommendedOrder.filter((item) => item.id !== priorityOne.id)
    : data.recommendedOrder;
  const priorityReason = priorityOne
    ? getPriorityReasonMeta({ data, item: priorityOne })
    : null;
  const planStatusCopy = data.membership.cancelAtPeriodEnd
    ? `Tu plan terminará al cierre actual${data.membership.currentPeriodEnd ? `, el ${formatDate(data.membership.currentPeriodEnd)}` : ""}.`
    : data.membership.billingStatus === "ACTIVE"
      ? data.membership.currentPeriodEnd
        ? `Tu membresía premium está activa hasta ${formatDate(data.membership.currentPeriodEnd)}.`
        : "Tu membresía premium está activa y desbloqueada."
      : data.membership.billingStatus === "PAST_DUE"
        ? "Tu membresía premium tiene un pago pendiente. Conviene regularizarla para no perder acceso."
        : data.membership.label === "Base"
          ? "Estás viendo el modo Base. Aquí ya tienes control y simulación simple, pero el plan recomendado sigue bloqueado."
          : data.membership.description;
  const activationSteps = [
    {
      id: "optimization",
      title: "Abrir plan inteligente",
      description: "Mira la comparación entre tu plan actual y el optimizado.",
      actionLabel: "Abrir plan",
      actionTarget: "optimization" as const,
    },
    {
      id: "priority",
      title: data.summary.recommendedDebtName
        ? `Confirmar foco en ${data.summary.recommendedDebtName}`
        : "Confirmar la deuda prioritaria",
      description: data.summary.recommendedDebtName
        ? `Asegúrate de que ${data.summary.recommendedDebtName} siga siendo la deuda a la que enviarás el excedente.`
        : "Revisa cuál deuda quedó primero antes de mover más dinero.",
      actionLabel: "Revisar prioridad",
      actionTarget: "debts" as const,
    },
    {
      id: "follow-up",
      title:
        data.dueSoonDebts.length > 0
          ? "Cubrir próximos vencimientos"
          : data.recentPayments.length === 0
            ? "Registrar tu primer avance"
            : "Mirar alertas y siguiente paso",
      description:
        data.dueSoonDebts.length > 0
          ? `Tienes ${data.dueSoonDebts.length} vencimiento${data.dueSoonDebts.length === 1 ? "" : "s"} cercano${data.dueSoonDebts.length === 1 ? "" : "s"} que conviene dejar alineado${data.dueSoonDebts.length === 1 ? "" : "s"}.`
          : data.recentPayments.length === 0
            ? "Registrar un pago te ayuda a convertir el plan en movimiento real desde hoy."
            : "Tus alertas y recomendaciones ya tienen suficiente contexto para una primera revisión semanal.",
      actionLabel:
        data.dueSoonDebts.length > 0
          ? "Ver vencimientos"
          : data.recentPayments.length === 0
            ? "Ir a pagos"
            : "Abrir alertas",
      actionTarget:
        data.dueSoonDebts.length > 0
          ? ("debts" as const)
          : data.recentPayments.length === 0
            ? ("payments" as const)
            : ("notifications" as const),
    },
  ];
  const activationCompletedCount = activationSteps.filter((step) =>
    activationCompletedSteps.includes(step.id),
  ).length;
  const activationProgressPct = Math.round(
    (activationCompletedCount / activationSteps.length) * 100,
  );
  const activationMinutesRemaining = Math.max(
    1,
    Math.ceil(activationRemainingMs / 60000),
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setChartsReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!initialShowOptimization || !isPremiumUnlocked) {
      return;
    }

    window.requestAnimationFrame(() => {
      optimizationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [initialShowOptimization, isPremiumUnlocked]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!isPremiumUnlocked) {
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        return;
      }

      const now = Date.now();
      let nextState = readPremiumActivationState();

      if (premiumWelcome) {
        nextState = {
          startedAt: now,
          completed: [],
        };
        persistPremiumActivationState(nextState);
      }

      if (!nextState) {
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        return;
      }

      const elapsed = now - nextState.startedAt;

      if (elapsed >= premiumActivationWindowMs) {
        persistPremiumActivationState(null);
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        return;
      }

      setShowPremiumWelcome(true);
      setActivationCompletedSteps(nextState.completed);
      setActivationRemainingMs(premiumActivationWindowMs - elapsed);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isPremiumUnlocked, premiumWelcome]);

  useEffect(() => {
    if (!showPremiumWelcome || typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      const currentState = readPremiumActivationState();

      if (!currentState) {
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        window.clearInterval(interval);
        return;
      }

      const remaining =
        premiumActivationWindowMs - (Date.now() - currentState.startedAt);

      if (remaining <= 0) {
        persistPremiumActivationState(null);
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        window.clearInterval(interval);
        return;
      }

      setActivationRemainingMs(remaining);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [showPremiumWelcome]);

  const revealOptimization = () => {
    if (!isPremiumUnlocked) {
      navigateTo(upgradePlanHref);
      return;
    }

    setShowOptimization(true);
    window.requestAnimationFrame(() => {
      optimizationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const completeActivationStep = (stepId: string) => {
    setActivationCompletedSteps((current) => {
      if (current.includes(stepId)) {
        return current;
      }

      const nextCompleted = [...current, stepId];
      const currentState = readPremiumActivationState();

      if (currentState) {
        persistPremiumActivationState({
          ...currentState,
          completed: nextCompleted,
        });
      }

      return nextCompleted;
    });
  };

  const dismissPremiumWelcome = () => {
    persistPremiumActivationState(null);
    setActivationCompletedSteps([]);
    setActivationRemainingMs(0);
    setShowPremiumWelcome(false);
  };

  const runActivationStepAction = (
    actionTarget: "optimization" | "debts" | "payments" | "notifications",
  ) => {
    if (actionTarget === "optimization") {
      revealOptimization();
      return;
    }

    if (actionTarget === "debts") {
      navigateTo("/deudas");
      return;
    }

    if (actionTarget === "payments") {
      navigateTo("/pagos");
      return;
    }

    navigateTo("/notificaciones");
  };

  const featuredStatCard = statCards[0];
  const secondaryStatCards = statCards.slice(1);
  const secondaryLeadStatCard = secondaryStatCards[0];
  const trailingSecondaryStatCards = secondaryStatCards.slice(1);
  const FeaturedStatIcon = featuredStatCard.icon;
  const SecondaryLeadStatIcon = secondaryLeadStatCard?.icon;
  const getStatCardValue = (card: (typeof statCards)[number]) => {
    const rawValue =
      card.key === "interestSavings"
        ? (data.summary.interestSavings ?? 0)
        : data.summary[card.key];

    if (card.key === "interestSavings" && !isPremiumUnlocked) {
      return "Premium";
    }

    return formatCurrency(rawValue);
  };
  const assistantCoachIcon =
    data.assistantCoach.tone === "warning" ? AlertTriangle : Sparkles;
  const assistantSecondaryAction = data.assistantCoach.secondaryAction
    ? {
        label: data.assistantCoach.secondaryAction.label,
        onClick: () => navigateTo(data.assistantCoach.secondaryAction?.href ?? "/dashboard"),
        variant: "secondary" as const,
      }
    : undefined;
  const dashboardSummaryItems: ExecutiveSummaryItem[] = [
    {
      label: "Deuda total",
      value: formatCurrency(data.summary.totalDebt),
      support: hasDebts
        ? "Saldo, mora y cargos que hoy están compitiendo por tu flujo."
        : "Todavía no hay deudas activas para construir una ruta real.",
      icon: CircleDollarSign,
      featured: true,
      badgeLabel: hasDebts ? "Panorama real" : "Activa tu base",
      badgeVariant: hasDebts ? "success" : "default",
    },
    {
      label: "Pago mínimo del mes",
      value: formatCurrency(data.summary.totalMinimumPayment),
      support: "Lo mínimo para que el mes no se te complique más.",
      icon: CalendarClock,
    },
    {
      label: "Interés estimado del mes",
      value: formatCurrency(data.summary.estimatedMonthlyInterest),
      support:
        data.summary.estimatedMonthlyInterest > 0
          ? `Estás pagando ${formatCurrency(data.summary.estimatedMonthlyInterest)} en intereses.`
          : "Cuando registres deuda activa, aquí verás el costo financiero del mes.",
      icon: AlertTriangle,
      badgeLabel:
        data.summary.estimatedMonthlyInterest > 0 ? "Costo visible" : undefined,
      badgeVariant: "warning" as const,
    },
    {
      label: "Tiempo estimado de salida",
      value: formatMonthsLabel(data.summary.monthsToDebtFree),
      support: data.summary.projectedDebtFreeDate
        ? `Si mantienes este ritmo, apuntas a ${formatDate(
            data.summary.projectedDebtFreeDate,
            "MMM yyyy",
          )}.`
        : "Completa deudas y pagos para proyectar una salida más clara.",
      icon: Sparkles,
      valueKind: "text" as const,
      badgeLabel:
        premiumMonthsSaved !== null && premiumMonthsSaved > 0
          ? `${premiumMonthsSaved} meses menos`
          : undefined,
      badgeVariant: "success" as const,
    },
    {
      label: "Prioridad actual",
      value:
        data.summary.recommendedDebtName ??
        data.urgentDebt?.name ??
        (hasDebts ? "Revisa tu prioridad" : "Registra tu primera deuda"),
      support: data.summary.recommendedDebtName
        ? "Hoy es la deuda que más conviene proteger o acelerar."
        : hasDebts
          ? "Aún falta una señal más clara para decirte cuál va primero."
          : "Con una deuda registrada ya activamos la prioridad principal.",
      icon: CreditCard,
      valueKind: "text" as const,
    },
  ];
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="-mx-1 grid gap-3 lg:hidden">
        <DailyMissionCard data={data} />
        <Card className="border-border shadow-soft rounded-[2rem] border bg-white/92 p-4">
          <CardHeader className="gap-3 px-0 pt-0">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="default">Dashboard</Badge>
              <Badge variant={data.riskAlerts.length > 0 ? "warning" : "success"}>
                {data.riskAlerts.length > 0 ? "Atención hoy" : "Bajo control"}
              </Badge>
            </div>
            <CardTitle className="text-[clamp(1.55rem,6vw,2rem)] leading-tight">
              {hasDebts ? "Qué mirar hoy" : "Activa tu panorama"}
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              {hasDebts
                ? "Lo esencial para decidir y moverte hoy."
                : "Registra tu primera deuda para activar el panel."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-0 pb-0">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-border/70 bg-secondary/45 p-4">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="size-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Deuda total
                  </p>
                </div>
                <p className="value-stable mt-3 text-[clamp(1.5rem,6vw,2rem)] font-semibold leading-none text-foreground">
                  {formatCurrency(data.summary.totalDebt)}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-secondary/45 p-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Próximo pago
                  </p>
                </div>
                <p className="mt-3 text-base font-semibold leading-tight text-foreground">
                  {nextTimelineItem?.debtName ?? "Sin fecha cercana"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {nextTimelineItem
                    ? formatDate(nextTimelineItem.occursOn)
                    : "Configura fechas para verlo aquí"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-secondary/45 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-primary" />
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Riesgo / interés
                  </p>
                </div>
                <p className="value-stable mt-3 text-[clamp(1.2rem,5vw,1.7rem)] font-semibold leading-tight text-foreground">
                  {mobileRiskLabel}
                </p>
                <p className="mt-1 text-xs text-muted">{mobileRiskSupport}</p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-primary/12 bg-[rgba(240,248,245,0.9)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
                    Progreso
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {debtProgressPct}% pagado
                  </p>
                </div>
                <p className="text-right text-xs text-muted">{mobileProgressLabel}</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/85">
                <div
                  className="h-full rounded-full bg-[linear-gradient(135deg,#0f584a_0%,#f08a5d_140%)] transition-all"
                  style={{ width: `${debtProgressPct}%` }}
                />
              </div>
            </div>

            {!isPremiumUnlocked && hasDebts && showDashboardPremiumPrompt ? (
              <div className="rounded-[1.5rem] border border-amber-200 bg-[rgba(255,248,241,0.96)] p-4">
                <p className="text-sm font-semibold text-foreground">
                  {data.analysisScope.partialAnalysis
                    ? "Todavía estás viendo solo una parte del costo real."
                    : `Estás pagando ${formatCurrency(data.summary.estimatedMonthlyInterest)} en intereses este mes.`}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {data.analysisScope.partialAnalysis
                    ? "Premium une todas tus deudas activas para que dejes de decidir con el panorama incompleto."
                    : "Premium te dice qué mover primero para dejar de perder más dinero este mes."}
                </p>
                <div className="mt-3">
                  <Button
                    className="w-full"
                    onClick={() => {
                      trackPlanEvent("upgrade_click", {
                        source: "dashboard_mobile_summary",
                        targetPlan: "NORMAL",
                      });
                      navigateTo(upgradePlanHref);
                    }}
                  >
                    {MEMBERSHIP_COMMERCIAL_COPY.contextualCta.dashboardPremium}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3">
              {mobileActionButtons.map((action) => (
                <Button
                  key={action.label}
                  variant={action.variant}
                  size="lg"
                  className="w-full"
                  onClick={() => navigateTo(action.href)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="hidden lg:flex lg:flex-col gap-5 sm:gap-6">
      <section className="border-border shadow-soft -mx-1 rounded-[2rem] border bg-white/90 p-4 sm:mx-0 sm:p-8">
        <div className="flex flex-col gap-5 sm:gap-6">
          {!isPremiumUnlocked && showDashboardPremiumPrompt ? (
            <Card className="border-amber-200 bg-[linear-gradient(135deg,rgba(255,248,241,0.98),rgba(255,255,255,0.94))] p-4 shadow-[0_22px_50px_rgba(240,138,93,0.1)] sm:p-5">
              <CardHeader className="gap-3 px-0 pt-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="warning">Atención</Badge>
                  <Badge variant="default">Esto no es tu mejor escenario</Badge>
                </div>
                <CardTitle className="text-balance text-[clamp(1.45rem,6vw,2.2rem)]">
                  Este no es tu mejor escenario
                </CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7">
                  Estás perdiendo dinero ahora mismo. {UPGRADE_MESSAGES.PARTIAL_VIEW}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 px-0 pb-0">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 text-sm leading-6 text-foreground">
                    <span className="font-semibold">
                      Estás pagando {formatCurrency(data.summary.estimatedMonthlyInterest)} en intereses
                    </span>{" "}
                    y ese dinero no está bajando capital tan rápido como podría.
                  </div>
                  <div className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 text-sm leading-6 text-foreground">
                    {data.analysisScope.partialAnalysis
                      ? "Hay deudas fuera del análisis Base. Tu lectura de hoy todavía está dejando dinero fuera del mapa."
                      : "Tu panorama ya muestra el costo. Lo que falta es ver la salida que menos te castiga."}
                  </div>
                  <div className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 text-sm leading-6 text-foreground">
                    Premium compara tu ruta actual contra una mejor para mostrarte cuánto podrías recuperar en tiempo y dinero.
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => {
                      trackPlanEvent("upgrade_click", {
                        source: "dashboard_warning_banner",
                        targetPlan: "NORMAL",
                      });
                      navigateTo(upgradePlanHref);
                    }}
                  >
                    {MEMBERSHIP_COMMERCIAL_COPY.contextualCta.dashboardPremium}
                  </Button>
                  <Button className="w-full sm:w-auto" variant="secondary" onClick={() => navigateTo("/simulador")}>
                    Abrir simulador
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <DashboardAssistantChat data={data} storageKey={claraStorageKey} />

          <ModuleSectionHeader
            kicker="Dashboard"
            title="Mini IA Clara te dice qué conviene hacer ahora."
            description="Clara lee tu panorama, detecta lo más urgente y te muestra una recomendación simple para avanzar sin abrir demasiados frentes."
            action={
              <Button
                onClick={() => {
                  if (!isPremiumUnlocked) {
                    trackPlanEvent("upgrade_click", {
                      source: "dashboard_header",
                      targetPlan: "NORMAL",
                    });
                  }
                  revealOptimization();
                }}
                size="lg"
                variant={isPremiumUnlocked ? "secondary" : "primary"}
                className="w-full sm:w-auto"
              >
                {isPremiumUnlocked ? "Ver mi plan" : getCommercialUpgradeCta("Premium")}
              </Button>
            }
          />

          <ExecutiveSummaryStrip items={dashboardSummaryItems} />

          <DailyMissionCard data={data} />

          <PrimaryActionCard
            eyebrow="Mini IA financiera"
            title={data.assistantCoach.title}
            description={data.assistantCoach.description}
            badgeLabel={data.assistantCoach.badgeLabel}
            badgeVariant={data.assistantCoach.badgeVariant}
            primaryAction={{
              label: data.assistantCoach.primaryAction.label,
              onClick: () => navigateTo(data.assistantCoach.primaryAction.href),
            }}
            secondaryAction={assistantSecondaryAction}
            notes={data.assistantCoach.notes}
            tone={data.assistantCoach.tone}
            icon={assistantCoachIcon}
          />

          <TrustInlineNote
            notes={[
              "Tus datos están protegidos.",
              "No conectamos cuentas bancarias.",
              "Tú controlas lo que registras.",
            ]}
          />

          <Card className="border-border/80 -mx-1 bg-white/92 p-4 sm:mx-0 sm:p-5">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <CalendarClock className="size-5" />
                  </span>
                  <div>
                    <CardTitle>{data.upcomingTimeline.headline}</CardTitle>
                    <CardDescription>{data.upcomingTimeline.support}</CardDescription>
                  </div>
                </div>
                <Badge variant="success">Siempre a tiempo</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {data.upcomingTimeline.items.length ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  {data.upcomingTimeline.items.map((item) => (
                    <div
                      key={`${item.debtId}-${item.eventType}-${item.occursOn}`}
                      className="rounded-[1.5rem] border border-border bg-secondary/45 p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                        {item.eventLabel}
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {item.debtName}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>
                      <p className="date-stable mt-3 text-sm font-medium text-foreground">
                        {formatDate(item.occursOn)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/30 p-4 text-sm leading-7 text-muted">
                  {data.upcomingTimeline.emptyState}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
            <NarrativeInsightCard
              kicker="Así va tu plan"
              title={momentumSummary.title}
              description={momentumSummary.description}
              badges={[
                {
                  label: momentumSummary.badgeLabel,
                  variant: momentumSummary.badgeVariant,
                },
                {
                  label: `${debtProgressPct}% de avance visible`,
                  variant: "default",
                },
              ]}
              tone="soft"
              footer={
                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                    <div className="flex min-w-0 items-end justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-muted text-xs tracking-[0.16em] uppercase">
                          Progreso hacia la salida
                        </p>
                        <p className="text-foreground mt-2 text-[clamp(1.1rem,3vw,1.35rem)] font-semibold leading-tight">
                          {debtProgressPct}%
                        </p>
                      </div>
                      <p className="support-copy min-w-0 max-w-xs text-right">
                        {momentumSummary.progressLabel}
                      </p>
                    </div>
                    <div className="bg-secondary mt-4 h-3 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(135deg,#0f584a_0%,#f08a5d_140%)]"
                        style={{ width: `${debtProgressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {progressMilestones.map((milestone) => (
                      <div
                        key={milestone.label}
                        className="rounded-3xl border border-white/70 bg-white/82 px-4 py-4"
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
                        <p className="support-copy mt-2">{milestone.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />

            <div className="min-w-0 rounded-[2rem] bg-[linear-gradient(160deg,rgba(12,88,74,0.98),rgba(33,132,113,0.92))] p-5 text-white shadow-[0_24px_60px_rgba(15,88,74,0.24)] sm:p-6">
              <p className="text-sm font-medium text-white/78">
                {isPremiumUnlocked
                  ? "Fecha estimada de salida"
                  : "Salida al ritmo actual"}
              </p>
              <p className="date-stable font-display mt-3 text-[clamp(1.8rem,4.8vw,2.7rem)] tracking-tight">
                {data.summary.projectedDebtFreeDate
                  ? formatDate(data.summary.projectedDebtFreeDate, "MMM yyyy")
                  : "Sin proyección"}
              </p>
              <p className="mt-2 text-sm leading-7 text-white/78">
                {data.summary.monthsToDebtFree !== null
                  ? `Si sostienes este ritmo, sales en ${data.summary.monthsToDebtFree} meses.`
                  : "Aún faltan datos para proyectar una salida confiable."}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-xs tracking-[0.16em] text-white/70 uppercase">
                    {isPremiumUnlocked ? "Ahorro estimado" : "Intereses visibles"}
                  </p>
                  <p className="value-stable mt-2 text-[clamp(1rem,2.8vw,1.2rem)] font-semibold leading-tight">
                    {isPremiumUnlocked
                      ? formatCurrency(data.planComparison?.interestSavings ?? 0)
                      : formatCurrency(data.summary.estimatedMonthlyInterest)}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-xs tracking-[0.16em] text-white/70 uppercase">
                    Recomendación principal
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/84">
                    {isPremiumUnlocked
                      ? data.planComparison?.immediateAction
                      : premiumConversionMessage}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 2xl:grid-cols-[1.02fr_0.98fr]">
            {showPremiumWelcome && isPremiumUnlocked ? (
              <div className="rounded-[1.75rem] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,248,241,0.92))] p-4 sm:p-5 xl:col-span-2">
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="success">Premium activo</Badge>
                      <Badge variant="warning">
                        {data.membership.guidanceLabel}
                      </Badge>
                      <Badge variant="default">
                        Primeros 5 minutos: {activationMinutesRemaining} min
                      </Badge>
                    </div>
                    <p className="text-foreground mt-4 text-2xl font-semibold">
                      Ya tienes acceso al plan recomendado. Vamos a convertirlo
                      en movimiento real.
                    </p>
                    <p className="text-muted mt-3 text-sm leading-7">
                      Este bloque te guía durante los primeros minutos con
                      Premium para que no te quedes solo con la compra hecha.
                      Si completas estos pasos ahora, el plan ya sale andando.
                    </p>
                    <div className="mt-4 rounded-[1.5rem] border border-emerald-200/70 bg-white/85 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                          <p className="text-muted text-xs tracking-[0.16em] uppercase">
                            Activación guiada
                          </p>
                          <p className="text-foreground mt-2 text-xl font-semibold">
                            {activationCompletedCount}/{activationSteps.length}{" "}
                            pasos completados
                          </p>
                          <p className="text-muted mt-2 text-sm leading-7">
                            El objetivo es que, antes de salir del dashboard, ya
                            sepas qué deuda enfocar y cuál es tu siguiente
                            movimiento.
                          </p>
                        </div>
                        <div className="min-w-[14rem]">
                          <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(135deg,#0f584a_0%,#218471_100%)] transition-all"
                              style={{ width: `${activationProgressPct}%` }}
                            />
                          </div>
                          <p className="text-muted mt-2 text-right text-xs">
                            {activationProgressPct}% de activación lista
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      {activationSteps.map((step, index) => {
                        const isCompleted = activationCompletedSteps.includes(
                          step.id,
                        );

                        return (
                          <div
                            key={step.id}
                            className="rounded-3xl bg-white/88 p-5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-muted text-xs tracking-[0.16em] uppercase">
                                Paso {index + 1}
                              </p>
                              <Badge
                                variant={isCompleted ? "success" : "default"}
                              >
                                {isCompleted ? "Listo" : "Pendiente"}
                              </Badge>
                            </div>
                            <p className="text-foreground mt-2 font-semibold">
                              {step.title}
                            </p>
                            <p className="text-muted mt-2 text-sm leading-6">
                              {step.description}
                            </p>
                            <div className="mt-4">
                              <Button
                                size="sm"
                                variant={isCompleted ? "secondary" : "primary"}
                                onClick={() => {
                                  completeActivationStep(step.id);
                                  runActivationStepAction(step.actionTarget);
                                }}
                              >
                                {step.actionLabel}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/70 bg-white/82 p-4 2xl:sticky 2xl:top-6">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Siguiente foco
                    </p>
                    <p className="text-foreground mt-2 text-lg font-semibold leading-tight">
                      Abre el plan, confirma la prioridad y deja listo el
                      siguiente movimiento.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      <Button
                        onClick={() => {
                          completeActivationStep("optimization");
                          revealOptimization();
                        }}
                      >
                        Abrir mi plan recomendado
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => navigateTo("/simulador")}
                      >
                        Ajustar en simulador
                      </Button>
                      <Button variant="ghost" onClick={dismissPremiumWelcome}>
                        Ocultar esta guía
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="border-border/80 bg-secondary/50 rounded-[1.75rem] border p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    needsBillingAttention
                      ? "warning"
                      : isPremiumUnlocked
                        ? "success"
                        : "default"
                  }
                >
                  Plan {data.membership.label}
                </Badge>
                <Badge variant={isPremiumUnlocked ? "success" : "default"}>
                  {data.membership.billingStatus === "ACTIVE"
                    ? "Activo"
                    : data.membership.billingStatus === "PAST_DUE"
                      ? "Pago pendiente"
                      : data.membership.billingStatus === "PENDING"
                        ? "Checkout pendiente"
                        : data.membership.billingStatus === "CANCELED"
                          ? "Cancelado"
                          : "Base"}
                </Badge>
              </div>
              <p className="text-foreground mt-4 text-lg font-semibold">
                {isPremiumUnlocked
                  ? "Tu copiloto premium está encendido"
                  : "Tu siguiente mejora está clara"}
              </p>
              <p className="text-muted mt-2 text-sm leading-7">
                {planStatusCopy}
              </p>
              <div className="mt-4 rounded-[1.45rem] border border-white/70 bg-white/82 p-4 text-sm leading-7 text-muted">
                {isPremiumUnlocked
                  ? "Aquí entras directo al simulador o revisas la estructura activa sin pasar por varias pantallas."
                  : "Aquí solo te mostramos el siguiente paso natural, no una lista larga de decisiones."}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  className="w-full sm:w-auto"
                  variant={
                    needsBillingAttention || !isPremiumUnlocked
                      ? "primary"
                      : "secondary"
                  }
                  onClick={() =>
                    navigateTo(
                      needsBillingAttention
                        ? managePlanHref
                        : !isPremiumUnlocked
                          ? upgradePlanHref
                          : "/simulador",
                    )
                  }
                >
                  {needsBillingAttention
                    ? "Resolver facturación"
                    : !isPremiumUnlocked
                      ? "Activar Premium"
                      : "Ir al simulador"}
                </Button>
                {hasDebts ? (
                  <Button className="w-full sm:w-auto" variant="ghost" onClick={() => navigateTo("/deudas")}>
                    Revisar deudas
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="border-primary/10 rounded-[1.75rem] border bg-[rgba(255,248,241,0.72)] p-4 sm:p-6">
              <p className="section-kicker">
                Luego puedes revisar
              </p>
              <p className="support-copy mt-3">
                Después de resolver lo principal, aquí dejas encaminado lo que
                sigue sin abrir demasiados frentes a la vez.
              </p>
              <div className="mt-4 grid gap-3">
                {secondaryQuickActions.length ? (
                  secondaryQuickActions.map((action) => {
                    const Icon = action.icon;

                    return (
                      <button
                        key={action.title}
                        type="button"
                        className="hover:border-primary/15 rounded-3xl border border-white/60 bg-white/80 p-4 text-left transition hover:bg-white"
                        onClick={() => navigateTo(action.href)}
                      >
                        <div className="flex items-start gap-3">
                          <span className="bg-secondary text-primary grid size-10 place-items-center rounded-2xl">
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground font-semibold">
                              {action.title}
                            </p>
                            <p className="text-muted mt-2 text-sm leading-7">
                              {action.description}
                            </p>
                            <span className="text-primary mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                              {action.actionLabel}
                              <ArrowRight className="size-4" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-muted rounded-3xl border border-white/60 bg-white/80 p-4 text-sm leading-7">
                    Después de resolver lo de hoy, aquí verás los siguientes
                    ajustes útiles para sostener el ritmo sin abrir demasiados
                    frentes a la vez.
                  </div>
                )}
              </div>
            </div>
          </div>

          {isPremiumUnlocked && currentPlan && optimizedPlan ? (
            <div className="grid gap-5">
              <div className="grid gap-5 2xl:grid-cols-2">
                {[currentPlan, optimizedPlan].map((plan) => (
                  <div
                    key={plan.label}
                    className="border-border/80 bg-secondary/55 rounded-[1.9rem] border p-6"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant={
                          plan.label === "Plan recomendado"
                            ? "success"
                            : "default"
                        }
                      >
                        {plan.label}
                      </Badge>
                      <Badge variant="default">
                        {formatMonthsLabel(plan.monthsToDebtFree)}
                      </Badge>
                    </div>
                    <p className="text-muted mt-4 text-sm">
                      {plan.strategyLabel}
                    </p>
                    <p className="date-stable text-foreground mt-3 text-[clamp(2rem,4.6vw,2.75rem)] font-semibold leading-none">
                      {plan.projectedDebtFreeDate
                        ? formatDate(plan.projectedDebtFreeDate, "MMM yyyy")
                        : "Sin fecha"}
                    </p>
                    <p className="text-muted mt-3 text-sm leading-7">
                      {getPlanSupportText(plan)}
                    </p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                        <p className="text-muted text-xs tracking-[0.16em] uppercase">
                          Intereses
                        </p>
                        <p className="value-stable text-foreground mt-2 text-xl font-semibold">
                          {formatCurrency(plan.totalInterest)}
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                        <p className="text-muted text-xs tracking-[0.16em] uppercase">
                          Presupuesto
                        </p>
                        <p className="value-stable text-foreground mt-2 text-xl font-semibold">
                          {formatCurrency(plan.monthlyBudget)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                <div className="border-primary/10 rounded-[1.9rem] border bg-[rgba(255,248,241,0.95)] p-6 shadow-[0_18px_42px_rgba(240,138,93,0.1)]">
                  <p className="section-kicker">
                    Plan recomendado
                  </p>
                  <p className="text-foreground mt-3 text-[clamp(1.7rem,4vw,2.3rem)] font-semibold leading-tight">
                    {data.planComparison?.headline}
                  </p>
                  <p className="support-copy mt-3">
                    {data.planComparison?.description}
                  </p>
                  <div className="text-foreground mt-5 rounded-[1.6rem] border border-white/70 bg-white/82 p-4 text-sm leading-7">
                    <span className="font-semibold">Por qué va primero:</span>{" "}
                    {data.planComparison?.immediateAction}
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.75rem] border border-border/80 bg-white/90 p-5">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Tiempo recortado
                    </p>
                    <p className="text-foreground mt-3 text-[clamp(1.45rem,3vw,1.9rem)] font-semibold leading-tight">
                      {data.planComparison?.monthsSaved !== null &&
                      (data.planComparison?.monthsSaved ?? 0) > 0
                        ? `${data.planComparison?.monthsSaved} meses`
                        : "Sin cambio material"}
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border border-border/80 bg-white/90 p-5">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Pago mensual sugerido
                    </p>
                    <p className="value-stable text-foreground mt-3 text-[clamp(1.45rem,3vw,1.9rem)] font-semibold leading-tight">
                      {formatCurrency(
                        data.planComparison?.suggestedMonthlyBudget ?? 0,
                      )}
                    </p>
                  </div>
                  {data.planComparison?.assumption ? (
                    <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
                      {data.planComparison.assumption}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 2xl:grid-cols-2">
              <div className="border-border/80 bg-secondary/55 rounded-[1.9rem] border p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <p className="text-foreground text-sm font-semibold">
                      Plan actual
                    </p>
                    <p className="text-muted text-sm">Modo base</p>
                  </div>
                  <Badge variant="default">
                    {formatMonthsLabel(data.summary.monthsToDebtFree)}
                  </Badge>
                </div>
                <p className="date-stable text-foreground mt-4 text-[clamp(2rem,4.6vw,2.75rem)] font-semibold leading-none">
                  {data.summary.projectedDebtFreeDate
                    ? formatDate(data.summary.projectedDebtFreeDate, "MMM yyyy")
                    : "Sin fecha"}
                </p>
                <p className="text-muted mt-2 text-sm leading-7">
                  Presupuesto mensual registrado:{" "}
                  {formatCurrency(data.summary.currentMonthlyBudget)}
                </p>
              </div>

              <div className="border-primary/25 rounded-[1.9rem] border border-dashed bg-[rgba(240,248,245,0.88)] p-6">
                <div className="flex items-center gap-3">
                  <span className="text-primary grid size-11 place-items-center rounded-2xl bg-white">
                    <LockKeyhole className="size-5" />
                  </span>
                  <div>
                    <p className="text-foreground text-sm font-semibold">
                      Plan recomendado bloqueado
                    </p>
                    <p className="text-muted text-sm">
                      Estás viendo solo una parte de la decisión.
                    </p>
                  </div>
                </div>
                <p className="text-primary mt-4 text-sm font-semibold tracking-[0.16em] uppercase">
                  {lockedUpgradeContext.eyebrow}
                </p>
                <p className="text-foreground mt-3 text-xl font-semibold">
                  {lockedUpgradeContext.title}
                </p>
                <p className="text-muted mt-2 text-sm leading-7">
                  {lockedUpgradeContext.description}
                </p>
                {lockedUpgradeContext.badges.length ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {lockedUpgradeContext.badges.map((badge) => (
                      <Badge key={badge} variant="warning">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Interés visible
                    </p>
                    <p className="value-stable text-foreground mt-2 font-semibold">
                      {formatCurrency(data.summary.estimatedMonthlyInterest)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Ritmo actual
                    </p>
                    <p className="text-foreground mt-2 font-semibold">
                      {formatMonthsLabel(data.summary.monthsToDebtFree)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm md:col-span-2 2xl:col-span-1">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Presión principal
                    </p>
                    <p className="text-foreground mt-2 font-semibold">
                      {data.summary.recommendedDebtName ??
                        data.urgentDebt?.name ??
                        "Por definir"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm">
                    <span className="font-semibold">Base:</span> control,
                    registro y simulación simple.
                  </div>
                  <div className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm">
                    <span className="font-semibold">Premium:</span> plan
                    recomendado para salir más rápido en 6 meses.
                  </div>
                  <div className="text-foreground rounded-3xl border border-white/70 bg-white/85 px-4 py-3 text-sm">
                    <span className="font-semibold">Pro:</span> seguimiento
                    premium extendido por 12 meses.
                  </div>
                </div>
              </div>

              <div className="border-primary/10 rounded-[1.75rem] border bg-[rgba(255,248,241,0.95)] p-4 shadow-[0_18px_42px_rgba(240,138,93,0.1)] sm:p-5 2xl:col-span-2">
                <p className="section-kicker">
                  Planes premium
                </p>
                <p className="text-foreground mt-3 text-2xl font-semibold">
                  Premium US$5/mes · US$49/año · ahorras US$11. Pro US$10/mes · US$99/año · ahorras US$21.
                </p>
                <p className="support-copy mt-3">
                  Premium está diseñado para quien quiere dejar de perder dinero más rápido. Pro extiende esa lógica con más seguimiento, más contexto y un flujo más completo.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => navigateTo(lockedUpgradeContext.primaryHref)}
                  >
                    {lockedUpgradeContext.primaryCtaLabel}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() =>
                      navigateTo(lockedUpgradeContext.secondaryHref)
                    }
                  >
                    {lockedUpgradeContext.secondaryCtaLabel}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="-mx-1 min-w-0 p-4 sm:mx-0 sm:p-7">
          <CardHeader className="gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {featuredStatCard.label}
                </CardDescription>
                <CardTitle className="value-stable mt-4 text-[clamp(2rem,4.8vw,3rem)] leading-none">
                  {getStatCardValue(featuredStatCard)}
                </CardTitle>
              </div>
              <div className="bg-secondary text-primary rounded-2xl p-3">
                <FeaturedStatIcon className="size-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-sm leading-7 text-muted">
            {featuredStatCard.description}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {secondaryLeadStatCard && SecondaryLeadStatIcon ? (
            <Card className="-mx-1 min-w-0 p-4 sm:mx-0 sm:p-6 md:col-span-2">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                    {secondaryLeadStatCard.label}
                  </CardDescription>
                  <div className="bg-secondary text-primary rounded-2xl p-2.5">
                    <SecondaryLeadStatIcon className="size-5" />
                  </div>
                </div>
                <CardTitle className="value-stable mt-1 text-[clamp(1.45rem,3.6vw,2rem)] leading-tight">
                  {getStatCardValue(secondaryLeadStatCard)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1 text-sm leading-6 text-muted">
                {secondaryLeadStatCard.description}
              </CardContent>
            </Card>
          ) : null}

          {trailingSecondaryStatCards.map((card) => {
            const Icon = card.icon;

            return (
              <Card key={card.key} className="-mx-1 min-w-0 p-4 sm:mx-0 sm:p-6">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                      {card.label}
                    </CardDescription>
                    <div className="bg-secondary text-primary rounded-2xl p-2.5">
                      <Icon className="size-4" />
                    </div>
                  </div>
                  <CardTitle className="value-stable mt-1 text-[clamp(1.2rem,3vw,1.7rem)] leading-tight">
                    {getStatCardValue(card)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1 text-sm leading-6 text-muted">
                  {card.key === "interestSavings" && !isPremiumUnlocked
                    ? "Se desbloquea al activar un plan premium."
                    : card.description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {isPremiumUnlocked && hasDebts ? (
        <section className="grid gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
          <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
            <CardHeader>
              <CardTitle>Seguimiento premium de la semana</CardTitle>
              <CardDescription>
                Un bloque simple para sostener el ritmo sin perderte en
                demasiadas decisiones.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="border-primary/12 rounded-[1.75rem] border bg-[rgba(240,248,245,0.92)] p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="success">Plan premium activo</Badge>
                  <Badge variant="warning">Próxima revisión en 7 días</Badge>
                </div>
                <p className="text-foreground mt-4 text-2xl font-semibold">
                  {data.summary.recommendedDebtName
                    ? `${data.summary.recommendedDebtName} sigue siendo tu foco principal`
                    : "Tu foco principal ya está definido en el plan recomendado"}
                </p>
                <p className="text-muted mt-3 text-sm leading-7">
                  Esta semana importa sostener el presupuesto sugerido, cubrir
                  los mínimos del resto y no desviar flujo de la prioridad
                  principal.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-white/85 p-4 sm:p-5 md:col-span-2">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Presupuesto sugerido
                    </p>
                    <p className="value-stable text-foreground mt-2 text-[clamp(1rem,2.8vw,1.2rem)] font-semibold">
                      {formatCurrency(
                        data.planComparison?.suggestedMonthlyBudget ?? 0,
                      )}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/85 p-4 sm:p-5">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Vencimientos cercanos
                    </p>
                    <p className="text-foreground mt-2 text-xl font-semibold">
                      {data.dueSoonDebts.length}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/85 p-4 sm:p-5">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Alertas activas
                    </p>
                    <p className="text-foreground mt-2 text-xl font-semibold">
                      {data.riskAlerts.length}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button onClick={revealOptimization}>
                    Revisar plan de esta semana
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigateTo("/pagos")}
                  >
                    Registrar avance
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
            <CardHeader>
              <CardTitle>
                {isProUnlocked
                  ? "Seguimiento Pro de esta semana"
                  : "Lo que Pro añade encima"}
              </CardTitle>
              <CardDescription>
                {isProUnlocked
                  ? "Más contexto para sostener tu ritmo durante más tiempo."
                  : "Premium ya te da la prioridad. Pro le añade más contexto y seguimiento."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {isProUnlocked ? (
                <>
                  <div className="border-border bg-secondary/70 rounded-3xl border p-4 sm:p-5">
                    <p className="text-foreground font-semibold">
                      1. Mantén la revisión semanal viva
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      {data.habitSignals.reviewPrompt ??
                        "Tu seguimiento ya tiene suficiente contexto para revisar avance, alertas y prioridad una vez por semana."}
                    </p>
                  </div>
                  <div className="border-border bg-secondary/70 rounded-3xl border p-4 sm:p-5">
                    <p className="text-foreground font-semibold">
                      2. Lee el progreso con más historial
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      Tienes {data.balanceHistory.length} puntos de saldo y{" "}
                      {data.recentPayments.length} pagos recientes visibles para
                      juzgar si el ritmo está mejorando o se está estancando.
                    </p>
                  </div>
                  <div className="border-border bg-secondary/70 rounded-3xl border p-4 sm:p-5">
                    <p className="text-foreground font-semibold">
                      3. Convierte alertas en seguimiento
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      Hoy tienes {data.riskAlerts.length} alerta
                      {data.riskAlerts.length === 1 ? "" : "s"} y{" "}
                      {data.dueSoonDebts.length} fecha
                      {data.dueSoonDebts.length === 1 ? "" : "s"} cercana
                      {data.dueSoonDebts.length === 1 ? "" : "s"} para sostener
                      el plan con más contexto operativo.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button onClick={() => navigateTo("/reportes")}>
                      Abrir reportes
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigateTo("/notificaciones")}
                    >
                      Revisar alertas
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="border-border bg-secondary/70 rounded-3xl border p-4 sm:p-5">
                    <p className="text-foreground font-semibold">
                      1. Más historia para leer tu ritmo
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      Pro amplía la profundidad de reportes e historial para que
                      no veas solo el momento actual, sino también si tu avance
                      se está sosteniendo.
                    </p>
                  </div>
                  <div className="border-border bg-secondary/70 rounded-3xl border p-4 sm:p-5">
                    <p className="text-foreground font-semibold">
                      2. Exportes y seguimiento más operativo
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      Premium resuelve la prioridad. Pro añade exportes CSV/PDF,
                      más contexto y una lectura más larga del plan.
                    </p>
                  </div>
                  <div className="border-primary/15 rounded-3xl border bg-[rgba(255,248,241,0.88)] p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <Badge variant="warning">Control total en Pro</Badge>
                      <Badge variant="default">Seguimiento 12 meses</Badge>
                    </div>
                    <p className="text-foreground mt-3 font-semibold">
                      Si ya estás usando Premium, Pro es la capa para sostenerlo
                      mejor.
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      Hoy ya tienes {data.riskAlerts.length} alerta
                      {data.riskAlerts.length === 1 ? "" : "s"} y{" "}
                      {data.dueSoonDebts.length} fecha
                      {data.dueSoonDebts.length === 1 ? "" : "s"} sensible
                      {data.dueSoonDebts.length === 1 ? "" : "s"}. Pro guarda
                      más contexto para que el seguimiento no dependa de memoria
                      corta.
                    </p>
                    <div className="mt-4">
                      <Button onClick={() => navigateTo("/planes?plan=PRO&source=dashboard")}>
                        Ver Pro
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-5 sm:gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
          <CardHeader>
            <CardTitle>Evolución del saldo</CardTitle>
            <CardDescription>
              Mira si tu saldo total va bajando o si se está estancando.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 pt-6">
            {hasHistory && chartsReady ? (
              <DashboardBalanceHistoryChart data={data.balanceHistory} />
            ) : hasHistory ? (
              <ChartLoadingPlaceholder />
            ) : (
              <div className="border-border bg-secondary/30 flex h-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center">
                <p className="text-foreground text-base font-semibold">
                  Todavía no hay historial suficiente
                </p>
                <p className="text-muted mt-2 max-w-sm text-sm leading-7">
                  A medida que registres pagos y cambios en tus deudas, aquí
                  verás si el saldo realmente va bajando o se está estancando.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
          <CardHeader>
            <CardTitle>Resumen por tipo</CardTitle>
            <CardDescription>
              Dónde se concentra la carga actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 pt-6">
            {hasBreakdown && chartsReady ? (
              <DashboardDebtBreakdownChart data={data.debtBreakdown} />
            ) : hasBreakdown ? (
              <ChartLoadingPlaceholder />
            ) : (
              <div className="border-border bg-secondary/30 flex h-full flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center">
                <p className="text-foreground text-base font-semibold">
                  Aquí aparecerá tu mezcla de deudas
                </p>
                <p className="text-muted mt-2 max-w-sm text-sm leading-7">
                  Cuando registres tarjetas, préstamos u otras obligaciones, el
                  sistema te mostrará dónde se concentra la presión real.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section
        ref={optimizationRef}
        className="grid gap-5 sm:gap-6 2xl:grid-cols-[1.14fr_0.86fr]"
      >
        <Card
          className={`p-4 transition sm:p-6 ${showOptimization ? "border-primary/25 ring-primary/10 ring-2" : ""}`}
        >
          <CardHeader>
            <CardTitle>Plan inteligente recomendado</CardTitle>
            <CardDescription>{data.strategyExplanation}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {isPremiumUnlocked && showOptimization && optimizedPlan ? (
              <div className="border-primary/10 rounded-[1.75rem] border bg-[rgba(240,248,245,0.92)] p-4 sm:p-5">
                <p className="text-primary text-sm font-semibold tracking-[0.18em] uppercase">
                  Resultado inmediato
                </p>
                <p className="text-foreground mt-3 text-2xl font-semibold">
                  {optimizedPlan.projectedDebtFreeDate
                    ? `Podrías salir en ${formatDate(optimizedPlan.projectedDebtFreeDate, "MMMM yyyy")}`
                    : "Todavía no hay una salida proyectable"}
                </p>
                <p className="text-muted mt-3 text-sm leading-7">
                  {data.planComparison?.immediateAction}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-3xl bg-white/90 p-4 sm:p-5">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Ruta elegida
                    </p>
                    <p className="value-stable text-foreground mt-2 font-semibold">
                      {optimizedPlan.strategyLabel}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/90 p-4 sm:p-5">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Intereses evitables
                    </p>
                    <p className="value-stable text-foreground mt-2 font-semibold">
                      {formatCurrency(
                        data.planComparison?.interestSavings ?? 0,
                      )}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/90 p-4 sm:p-5 md:col-span-2">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Pago mensual sugerido
                    </p>
                    <p className="text-foreground mt-2 font-semibold">
                      {formatCurrency(
                        data.planComparison?.suggestedMonthlyBudget ?? 0,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : isPremiumUnlocked ? (
              <div className="border-border text-muted rounded-[1.75rem] border border-dashed p-5 text-sm leading-7">
                Pulsa{" "}
                <span className="text-foreground font-semibold">
                  Optimizar mi plan
                </span>{" "}
                para fijar la ruta recomendada y resaltar el orden exacto de
                pago con tu presupuesto actual.
              </div>
            ) : (
              <div className="border-primary/20 text-muted rounded-[1.75rem] border border-dashed bg-[rgba(255,248,241,0.92)] p-5 text-sm leading-7">
                <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                  {lockedUpgradeContext.eyebrow}
                </p>
                <p className="text-foreground mt-3 text-xl font-semibold">
                  {lockedUpgradeContext.title}
                </p>
                <p className="text-muted mt-2 text-sm leading-7">
                  {lockedUpgradeContext.description}
                </p>
                {lockedUpgradeContext.badges.length ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {lockedUpgradeContext.badges.map((badge) => (
                      <Badge key={badge} variant="warning">
                        {badge}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => navigateTo(lockedUpgradeContext.primaryHref)}
                  >
                    {lockedUpgradeContext.primaryCtaLabel}
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    variant="secondary"
                    onClick={() =>
                      navigateTo(lockedUpgradeContext.secondaryHref)
                    }
                  >
                    {lockedUpgradeContext.secondaryCtaLabel}
                  </Button>
                </div>
              </div>
            )}

            {priorityOne ? (
              <div className="rounded-[1.85rem] border border-primary/20 bg-[linear-gradient(145deg,rgba(240,248,245,0.96),rgba(255,248,241,0.92))] p-4 shadow-[0_22px_48px_rgba(15,88,74,0.1)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_24px_46px_rgba(15,88,74,0.12)] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-4xl">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="success">Prioridad 1</Badge>
                      {priorityReason ? (
                        <Badge variant={priorityReason.badgeVariant}>
                          {priorityReason.badgeLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-foreground mt-4 text-2xl font-semibold">
                      {priorityOne.name}
                    </p>
                    <p className="text-muted mt-3 text-sm leading-7">
                      {priorityOne.explanation}
                    </p>
                    {priorityReason ? (
                      <div className="text-foreground mt-4 rounded-3xl border border-white/70 bg-white/85 p-4 text-sm leading-7">
                        <span className="font-semibold">Por qué va primero:</span>{" "}
                        {priorityReason.support}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-col gap-3 lg:w-auto">
                    <Button
                      className="w-full lg:w-auto"
                      onClick={() => navigateTo(paymentPriorityHref)}
                    >
                      Actuar sobre prioridad 1
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Saldo actual
                    </p>
                    <p className="value-stable text-foreground mt-2 font-semibold">
                      {formatCurrency(priorityOne.balance)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Tasa mensual aprox.
                    </p>
                    <p className="value-stable text-foreground mt-2 font-semibold">
                      {priorityOne.monthlyRatePct.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 text-sm md:col-span-2">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Si la sostienes
                    </p>
                    <p className="text-foreground mt-2 font-semibold">
                      {data.planComparison?.monthsSaved &&
                      data.planComparison.monthsSaved > 0
                        ? `${data.planComparison.monthsSaved} meses menos`
                        : "Más control del flujo"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {hasRecommendedOrder ? (
              remainingRecommendedOrder.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-[1.75rem] border p-4 transition-all duration-200 ease-out sm:p-5 ${
                    item.priorityRank === 1
                      ? "border-primary/20 bg-[rgba(240,248,245,0.92)] shadow-[0_18px_42px_rgba(15,88,74,0.08)] hover:shadow-[0_22px_44px_rgba(15,88,74,0.11)]"
                      : "border-border bg-secondary/70 hover:border-primary/18 hover:bg-white/92 hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)]"
                  }`}
                >
                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_260px] 2xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          variant={
                            item.priorityRank === 1 ? "success" : "default"
                          }
                        >
                          Prioridad {item.priorityRank}
                        </Badge>
                        {item.priorityRank === 1 ? (
                          <Badge variant="warning">Enfoque principal</Badge>
                        ) : null}
                      </div>
                      <p className="text-foreground mt-3 text-lg font-semibold">
                        {item.name}
                      </p>
                      <p className="text-muted mt-2 text-sm leading-7">
                        {item.explanation}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                      <div className="rounded-3xl border border-white/70 bg-white/85 p-4 text-sm">
                        <p className="text-muted text-xs tracking-[0.16em] uppercase">
                          Saldo actual
                        </p>
                        <p className="value-stable text-foreground mt-2 font-semibold">
                          {formatCurrency(item.balance)}
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/70 bg-white/85 p-4 text-sm">
                        <p className="text-muted text-xs tracking-[0.16em] uppercase">
                          Tasa mensual aprox.
                        </p>
                        <p className="value-stable text-foreground mt-2 font-semibold">
                          {item.monthlyRatePct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="border-border bg-secondary/35 text-muted rounded-[1.75rem] border border-dashed p-5 text-sm leading-7">
                {hasDebts
                  ? "Activa Premium o completa más información de tus deudas para que el sistema te muestre el orden exacto de pago."
                  : "Agrega al menos una deuda para que el sistema pueda priorizarla y construir una ruta de salida."}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 sm:gap-6">
          <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
            <CardHeader>
              <CardTitle>Deuda más urgente</CardTitle>
              <CardDescription>
                La cuenta que más presión genera por fecha o atraso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {data.urgentDebt ? (
                <>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        data.urgentDebt.status === "LATE" ? "danger" : "warning"
                      }
                    >
                      {data.urgentDebt.status === "LATE"
                        ? "Atrasada"
                        : "Próxima"}
                    </Badge>
                    <p className="text-foreground text-lg font-semibold">
                      {data.urgentDebt.name}
                    </p>
                  </div>
                  <p className="text-muted text-sm">
                    {data.urgentDebt.creditorName}
                  </p>
                  <p className="value-stable text-foreground text-[clamp(1.6rem,5vw,2.25rem)] font-semibold">
                    {formatCurrency(data.urgentDebt.effectiveBalance)}
                  </p>
                  {data.urgentDebt.nextDueDate ? (
                    <p className="text-muted text-sm">
                      Vence{" "}
                      {formatRelativeDistance(data.urgentDebt.nextDueDate)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted text-sm">
                  Aún no tienes deudas activas.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
            <CardHeader>
              <CardTitle>Alertas de riesgo</CardTitle>
              <CardDescription>
                Señales rápidas para evitar seguir pagando de más.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {data.riskAlerts.length ? (
                data.riskAlerts.map((alert) => (
                <div
                  key={alert.title}
                  className="border-border bg-secondary/70 rounded-3xl border p-4 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-primary/18 hover:bg-white/92 hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)] active:scale-[0.997] sm:p-5"
                >
                    <p className="text-foreground font-semibold">
                      {alert.title}
                    </p>
                    <p className="text-muted mt-2 text-sm leading-7">
                      {alert.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted text-sm">
                  No hay alertas críticas en este momento.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 sm:gap-6 xl:grid-cols-2">
        <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
          <CardHeader>
            <CardTitle>Próximos vencimientos</CardTitle>
            <CardDescription>
              Lo que debes vigilar en los siguientes días.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.dueSoonDebts.length ? (
              data.dueSoonDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="border-border bg-secondary/70 grid min-w-0 gap-4 rounded-3xl border p-4 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-primary/18 hover:bg-white/92 hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)] active:scale-[0.997] sm:grid-cols-[minmax(0,1fr)_170px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold">{debt.name}</p>
                    <p className="date-stable text-muted mt-1 text-sm">
                      {debt.nextDueDate
                        ? formatDate(debt.nextDueDate)
                        : "Sin fecha"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-3 sm:text-right">
                    <p className="text-muted text-xs tracking-[0.16em] uppercase">
                      Pago mínimo
                    </p>
                    <p className="value-stable text-foreground mt-2 text-sm font-semibold">
                      {formatCurrency(debt.minimumPayment)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted text-sm">
                No hay vencimientos cercanos registrados.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="-mx-1 p-4 sm:mx-0 sm:p-6">
          <CardHeader>
            <CardTitle>Pagos recientes</CardTitle>
            <CardDescription>
              Últimos movimientos registrados en tu historial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.recentPayments.length ? (
              data.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="border-border bg-secondary/70 grid min-w-0 gap-4 rounded-3xl border p-4 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-primary/18 hover:bg-white/92 hover:shadow-[0_18px_34px_-26px_rgba(23,56,74,0.24)] active:scale-[0.997] sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold">
                      {payment.debtName}
                    </p>
                    <p className="date-stable text-muted mt-1 text-sm">
                      {formatDate(payment.paidAt)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-3 sm:text-right">
                    <p className="value-stable text-foreground text-sm font-semibold">
                      {formatCurrency(payment.amount)}
                    </p>
                    <p className="value-stable text-muted mt-2 text-xs">
                      Principal {formatCurrency(payment.principalAmount ?? 0)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted text-sm">
                Todavía no hay pagos registrados.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
      </div>
    </div>
  );
}
