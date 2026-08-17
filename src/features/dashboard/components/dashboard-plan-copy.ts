import type { DashboardPlanSnapshotDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

const planReasonLabels: Record<string, string> = {
  budget_below_minimum:
    "El presupuesto actual no cubre los mínimos necesarios.",
  non_amortizing: "A este ritmo, la deuda no baja de forma sostenible.",
  max_months_reached: "La proyección supera el horizonte razonable de cálculo.",
};

export function getPlanSupportText(plan: DashboardPlanSnapshotDto) {
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
