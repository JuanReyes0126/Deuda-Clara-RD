import type { DashboardDto } from "@/lib/types/app";

export type PremiumActivationActionTarget =
  | "optimization"
  | "debts"
  | "payments"
  | "notifications";

export type PremiumActivationStep = {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionTarget: PremiumActivationActionTarget;
};

export function buildPremiumActivationSteps(data: DashboardDto): PremiumActivationStep[] {
  return [
    {
      id: "optimization",
      title: "Abrir plan inteligente",
      description: "Mira la comparación entre tu plan actual y el optimizado.",
      actionLabel: "Abrir plan",
      actionTarget: "optimization",
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
      actionTarget: "debts",
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
          ? "debts"
          : data.recentPayments.length === 0
            ? "payments"
            : "notifications",
    },
  ];
}

export function getActivationProgress(
  steps: PremiumActivationStep[],
  completedStepIds: string[],
) {
  const completedCount = steps.filter((step) =>
    completedStepIds.includes(step.id),
  ).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return { completedCount, progressPct };
}
