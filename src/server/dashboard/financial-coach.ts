import type {
  DashboardCoachDto,
  DashboardPlanComparisonDto,
  DebtItemDto,
  PaymentItemDto,
} from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

type DashboardFinancialCoachInput = {
  analysisScope: {
    hiddenDebtCount: number;
    partialAnalysis: boolean;
  };
  summary: {
    totalDebt: number;
    totalMinimumPayment: number;
    monthlyIncome: number | null;
    monthlyEssentialExpensesTotal: number | null;
    monthlyDebtCapacity: number | null;
    estimatedMonthlyInterest: number;
    recommendedDebtName: string | null;
    recommendedDebtId: string | null;
    interestSavings: number | null;
  };
  planComparison: DashboardPlanComparisonDto | null;
  habitSignals: {
    reviewPrompt: string | null;
    momentumMessage: string;
    microFeedback: string;
  };
  dueSoonDebts: DebtItemDto[];
  urgentDebt: DebtItemDto | null;
  riskAlerts: Array<{ title: string; description: string }>;
  recentPayments: PaymentItemDto[];
};

function buildDebtPaymentHref(debtId: string | null) {
  return debtId ? `/pagos?debtId=${debtId}&from=assistant` : "/pagos?from=assistant";
}

function formatDebtAmount(value: number, debt: DebtItemDto | null) {
  return formatCurrency(value, debt?.currency ?? "DOP");
}

export function buildDashboardFinancialCoach(
  input: DashboardFinancialCoachInput,
): DashboardCoachDto {
  if (input.summary.totalDebt <= 0) {
    return {
      title: "Vamos a construir tu panorama real.",
      description:
        "Registra tu primera deuda y te diré qué conviene pagar primero, cuánto te está costando y cuál sería tu siguiente paso.",
      badgeLabel: "Primer paso",
      badgeVariant: "default",
      tone: "default",
      primaryAction: {
        label: "Registrar mi primera deuda",
        href: "/deudas?from=assistant",
      },
      secondaryAction: {
        label: "Abrir simulador",
        href: "/simulador?from=assistant",
      },
      notes: [
        "Con una deuda activa ya puedo detectar prioridad, riesgo y vencimientos.",
        "Mientras más completo esté tu panorama, mejor será la recomendación.",
      ],
    };
  }

  if (input.urgentDebt?.status === "LATE") {
    return {
      title: `Hoy conviene cubrir ${input.urgentDebt.name}.`,
      description: `Tu mini IA detecta que esta deuda ya está atrasada. Prioriza al menos ${formatDebtAmount(input.urgentDebt.minimumPayment, input.urgentDebt)} para bajar presión inmediata y evitar más cargos.`,
      badgeLabel: "Atención hoy",
      badgeVariant: "danger",
      tone: "warning",
      primaryAction: {
        label: "Registrar pago ahora",
        href: buildDebtPaymentHref(input.urgentDebt.id),
      },
      secondaryAction: {
        label: "Revisar deuda",
        href: "/deudas?from=assistant",
      },
      notes: [
        `Saldo sensible: ${formatDebtAmount(input.urgentDebt.effectiveBalance, input.urgentDebt)}.`,
        `Acreedor: ${input.urgentDebt.creditorName}.`,
        input.riskAlerts.length > 0
          ? `Además tienes ${input.riskAlerts.length} alerta${input.riskAlerts.length === 1 ? "" : "s"} activa${input.riskAlerts.length === 1 ? "" : "s"}.`
          : "Resolver esta deuda primero te devuelve control más rápido.",
      ],
    };
  }

  const nextDueDebt = input.dueSoonDebts[0] ?? null;

  if (nextDueDebt) {
    return {
      title: `Protege ${nextDueDebt.name} antes del próximo vencimiento.`,
      description: `Tu siguiente mejor movimiento es dejar lista esta deuda antes del corte. Así evitas atrasos innecesarios y mantienes el plan estable.`,
      badgeLabel: "Vencimiento cerca",
      badgeVariant: "warning",
      tone: "warning",
      primaryAction: {
        label: "Preparar ese pago",
        href: buildDebtPaymentHref(nextDueDebt.id),
      },
      secondaryAction: {
        label: "Ver mis deudas",
        href: "/deudas?from=assistant",
      },
      notes: [
        nextDueDebt.nextDueDate
          ? `Próximo vencimiento: ${formatDate(nextDueDebt.nextDueDate)}.`
          : "Esta deuda ya está entrando en la ventana sensible de seguimiento.",
        `Pago actual: ${formatDebtAmount(nextDueDebt.minimumPayment, nextDueDebt)}.`,
        `Interés estimado del mes: ${formatDebtAmount(nextDueDebt.monthlyInterestEstimate, nextDueDebt)}.`,
      ],
    };
  }

  const missingCashflowProfile =
    input.summary.monthlyIncome === null ||
    input.summary.monthlyEssentialExpensesTotal === null;

  if (missingCashflowProfile) {
    return {
      title: "Todavía me falta tu flujo mensual para aconsejarte mejor.",
      description:
        "Si me dices cuánto generas al mes y cuánto se te va en gastos esenciales, puedo dejar de recomendar a ciegas y ajustarte una ruta más realista.",
      badgeLabel: "Completa tu perfil",
      badgeVariant: "default",
      tone: "default",
      primaryAction: {
        label: "Completar mis ingresos y gastos",
        href: "/configuracion?from=assistant",
      },
      secondaryAction: {
        label: "Ir al simulador",
        href: "/simulador?from=assistant",
      },
      notes: [
        "Esto ayuda a distinguir cuánto realmente puedes mandar a deuda cada mes.",
        "Con ese dato, el simulador y las prioridades se vuelven mucho más confiables.",
      ],
    };
  }

  if (
    input.summary.monthlyDebtCapacity !== null &&
    input.summary.totalMinimumPayment > input.summary.monthlyDebtCapacity
  ) {
    return {
      title: "Tu presupuesto actual está apretado para sostener las deudas.",
      description: `Hoy tus pagos mínimos rondan ${formatCurrency(input.summary.totalMinimumPayment)} y tu capacidad mensual disponible luce en ${formatCurrency(input.summary.monthlyDebtCapacity)}. Conviene ajustar flujo antes de prometer pagos que no vas a sostener.`,
      badgeLabel: "Ajusta tu flujo",
      badgeVariant: "warning",
      tone: "warning",
      primaryAction: {
        label: "Revisar mis gastos base",
        href: "/configuracion?from=assistant",
      },
      secondaryAction: {
        label: "Simular otro ritmo",
        href: "/simulador?from=assistant",
      },
      notes: [
        `Ingreso mensual registrado: ${formatCurrency(input.summary.monthlyIncome ?? 0)}.`,
        `Gastos esenciales estimados: ${formatCurrency(input.summary.monthlyEssentialExpensesTotal ?? 0)}.`,
        "Primero asegura sostenibilidad, luego acelera pagos.",
      ],
    };
  }

  if (input.recentPayments.length === 0) {
    return {
      title: "Conviene registrar tu primer pago cuanto antes.",
      description:
        "Con un pago registrado ya puedo medir avance real, detectar mejor el ritmo del mes y afinar la recomendación que te doy.",
      badgeLabel: "Activa seguimiento",
      badgeVariant: "success",
      tone: "default",
      primaryAction: {
        label: "Registrar primer pago",
        href: "/pagos?from=assistant",
      },
      secondaryAction: {
        label: "Ver deudas",
        href: "/deudas?from=assistant",
      },
      notes: [
        "Sin pagos registrados, la app solo ve intención; con pagos, ya ve ejecución.",
        input.habitSignals.microFeedback,
      ],
    };
  }

  if (input.riskAlerts.length > 0) {
    return {
      title: "Hay deudas que están avanzando demasiado lento.",
      description:
        "Detecté señales de pago mínimo riesgoso. Conviene revisar esas cuentas y decidir dónde meter un poco más para no seguir girando en círculo.",
      badgeLabel: "Riesgo detectado",
      badgeVariant: "warning",
      tone: "warning",
      primaryAction: {
        label: "Revisar prioridad",
        href: "/deudas?from=assistant",
      },
      secondaryAction: {
        label: "Abrir simulador",
        href: "/simulador?from=assistant",
      },
      notes: [
        input.riskAlerts[0]?.title ?? "Hay al menos una deuda que necesita atención.",
        input.habitSignals.microFeedback,
      ],
    };
  }

  if ((input.planComparison?.interestSavings ?? 0) > 0 || (input.planComparison?.monthsSaved ?? 0) > 0) {
    return {
      title: "Ya hay una mejora clara que puedes aplicar.",
      description: input.planComparison?.immediateAction ??
        "Tu estructura actual ya permite ajustar el orden o el ritmo para salir antes.",
      badgeLabel: "Mejora visible",
      badgeVariant: "success",
      tone: "default",
      primaryAction: {
        label: "Ver mi simulación",
        href: "/simulador?from=assistant",
      },
      secondaryAction: {
        label: "Ir a pagos",
        href: buildDebtPaymentHref(input.summary.recommendedDebtId),
      },
      notes: [
        (input.planComparison?.interestSavings ?? 0) > 0
          ? `Ahorro potencial: ${formatCurrency(input.planComparison?.interestSavings ?? 0)}.`
          : "Hay margen real para mejorar el orden del dinero.",
        (input.planComparison?.monthsSaved ?? 0) > 0
          ? `Tiempo potencial que podrías recortar: ${input.planComparison?.monthsSaved} ${input.planComparison?.monthsSaved === 1 ? "mes" : "meses"}.`
          : input.habitSignals.momentumMessage,
      ],
    };
  }

  return {
    title: input.summary.recommendedDebtName
      ? `Sigue enfocando ${input.summary.recommendedDebtName}.`
      : "Tu plan va estable. Mantén el siguiente paso claro.",
    description:
      input.habitSignals.reviewPrompt ??
      "No veo un incendio inmediato. El mejor soporte ahora es sostener el ritmo y no dispersar el dinero.",
    badgeLabel: input.analysisScope.partialAnalysis ? "Panorama parcial" : "Buen ritmo",
    badgeVariant: input.analysisScope.partialAnalysis ? "default" : "success",
    tone: "default",
    primaryAction: {
      label: input.summary.recommendedDebtId ? "Registrar siguiente pago" : "Revisar deudas",
      href: input.summary.recommendedDebtId
        ? buildDebtPaymentHref(input.summary.recommendedDebtId)
        : "/deudas?from=assistant",
    },
    secondaryAction: {
      label: "Abrir simulador",
      href: "/simulador?from=assistant",
    },
    notes: [
      input.habitSignals.momentumMessage,
      input.habitSignals.microFeedback,
      input.analysisScope.partialAnalysis
        ? `Todavía hay ${input.analysisScope.hiddenDebtCount} deuda${input.analysisScope.hiddenDebtCount === 1 ? "" : "s"} fuera del análisis principal.`
        : `Interés estimado actual del mes: ${formatCurrency(input.summary.estimatedMonthlyInterest)}.`,
    ],
  };
}
