import type { DashboardDto } from "@/lib/types/app";

export type DailyMission = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  streakWeeks: number;
};

function daysSincePaidAt(paidAtIso: string, nowMs: number) {
  const t = new Date(paidAtIso).getTime();
  if (!Number.isFinite(t)) {
    return null;
  }

  return (nowMs - t) / 86_400_000;
}

/**
 * Una sola acción prioritaria para reducir fricción y aburrimiento en el panel.
 */
export function buildDailyMission(
  data: DashboardDto,
  now: Date = new Date(),
): DailyMission {
  const streak = data.habitSignals.weeklyStreak;
  const nowMs = now.getTime();

  if (data.analysisScope.activeDebtCount === 0) {
    return {
      title: "Tu misión de hoy",
      body:
        data.habitSignals.reviewPrompt ??
        "Registra tu primera deuda para activar tu plan y ver progreso real.",
      ctaLabel: "Ir a deudas",
      ctaHref: "/deudas",
      streakWeeks: streak,
    };
  }

  if (data.urgentDebt?.status === "LATE") {
    return {
      title: "Tu misión de hoy",
      body: `Atiende primero ${data.urgentDebt.name}: está atrasada y frena todo lo demás.`,
      ctaLabel: "Registrar pago",
      ctaHref: "/pagos",
      streakWeeks: streak,
    };
  }

  const next = data.upcomingTimeline.items[0];
  if (next && next.daysUntil <= 5) {
    return {
      title: "Tu misión de hoy",
      body: `${next.eventLabel} · ${next.debtName}. ${next.summary}`,
      ctaLabel: "Ver pagos y fechas",
      ctaHref: "/pagos",
      streakWeeks: streak,
    };
  }

  if (data.recentPayments.length === 0) {
    return {
      title: "Tu misión de hoy",
      body: "Registra tu primer pago: así el panel refleja avance real y Clara puede guiarte mejor.",
      ctaLabel: "Ir a pagos",
      ctaHref: "/pagos",
      streakWeeks: streak,
    };
  }

  const last = data.recentPayments[0];
  if (!last) {
    return {
      title: "Tu misión de hoy",
      body: data.habitSignals.momentumMessage,
      ctaLabel: data.assistantCoach.primaryAction.label,
      ctaHref: data.assistantCoach.primaryAction.href,
      streakWeeks: streak,
    };
  }

  const daysSince = daysSincePaidAt(last.paidAt, nowMs);
  if (daysSince !== null && daysSince > 14) {
    return {
      title: "Tu misión de hoy",
      body: "Llevas más de dos semanas sin registrar movimiento. Un pago hoy mantiene viva tu estrategia.",
      ctaLabel: "Registrar pago",
      ctaHref: "/pagos",
      streakWeeks: streak,
    };
  }

  return {
    title: "Tu misión de hoy",
    body: data.habitSignals.momentumMessage,
    ctaLabel: data.assistantCoach.primaryAction.label,
    ctaHref: data.assistantCoach.primaryAction.href,
    streakWeeks: streak,
  };
}
