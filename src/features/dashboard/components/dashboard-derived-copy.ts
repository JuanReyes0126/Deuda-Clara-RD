import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { formatMonthsLabel } from "./dashboard-formatters";

export function getMobileRiskLabel(data: DashboardDto) {
  return data.riskAlerts.length > 0
    ? `${data.riskAlerts.length} alerta${data.riskAlerts.length === 1 ? "" : "s"}`
    : formatCurrency(data.summary.estimatedMonthlyInterest);
}

export function getMobileRiskSupport(data: DashboardDto) {
  return data.riskAlerts.length > 0 ? "Requiere atención hoy" : "Interés del mes";
}

export function getMobileProgressLabel(input: {
  data: DashboardDto;
}) {
  return input.data.summary.projectedDebtFreeDate
    ? `Salida estimada: ${formatDate(input.data.summary.projectedDebtFreeDate, "MMM yyyy")}`
    : formatMonthsLabel(input.data.summary.monthsToDebtFree);
}

export function getPlanStatusCopy(data: DashboardDto) {
  return data.membership.cancelAtPeriodEnd
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
}
