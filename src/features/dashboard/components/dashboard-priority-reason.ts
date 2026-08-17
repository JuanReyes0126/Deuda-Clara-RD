import type { DashboardDto } from "@/lib/types/app";
import { formatRelativeDistance } from "@/lib/utils/date";

type RecommendedDebtPriorityItem = DashboardDto["recommendedOrder"][number];

export function getPriorityReasonMeta({
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
