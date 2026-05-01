import { AlertTriangle, CalendarClock, CircleDollarSign, Sparkles } from "lucide-react";

import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

export const dashboardStatCards = [
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

export function getDashboardStatCardValue(input: {
  data: DashboardDto;
  isPremiumUnlocked: boolean;
  key: (typeof dashboardStatCards)[number]["key"];
}) {
  const { data, isPremiumUnlocked, key } = input;
  const rawValue =
    key === "interestSavings"
      ? (data.summary.interestSavings ?? 0)
      : data.summary[key];

  if (key === "interestSavings" && !isPremiumUnlocked) {
    return "Premium";
  }

  return formatCurrency(rawValue);
}
