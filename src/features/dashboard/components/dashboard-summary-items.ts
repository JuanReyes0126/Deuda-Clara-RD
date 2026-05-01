import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Sparkles,
} from "lucide-react";

import type { ExecutiveSummaryItem } from "@/components/shared/executive-summary-strip";
import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { formatMonthsLabel } from "./dashboard-formatters";

export function buildDashboardSummaryItems(input: {
  data: DashboardDto;
  hasDebts: boolean;
  premiumMonthsSaved: number | null;
}): ExecutiveSummaryItem[] {
  const { data, hasDebts, premiumMonthsSaved } = input;

  return [
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
      badgeVariant: "warning",
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
      valueKind: "text",
      badgeLabel:
        premiumMonthsSaved !== null && premiumMonthsSaved > 0
          ? `${premiumMonthsSaved} meses menos`
          : undefined,
      badgeVariant: "success",
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
      valueKind: "text",
    },
  ];
}
