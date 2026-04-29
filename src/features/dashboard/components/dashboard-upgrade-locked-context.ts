import type {
  DashboardDto,
  MembershipConversionSnapshotDto,
} from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

export function getLockedUpgradeContext({
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
