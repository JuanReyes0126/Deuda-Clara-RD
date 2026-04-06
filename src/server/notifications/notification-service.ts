import {
  NotificationChannel,
  NotificationSeverity,
  NotificationType,
} from "@prisma/client";
import { addDays, endOfMonth, startOfMonth } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import type { NotificationItemDto, ReportSummaryDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { isMinimumPaymentRisk } from "@/server/finance/debt-helpers";
import { calculateDebtStrategy } from "@/server/planner/strategy-engine";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { ServiceError } from "@/server/services/service-error";
import { logServerError } from "@/server/observability/logger";
import { buildNotificationDigest } from "@/server/notifications/notification-digest";
import { getReportSummary } from "@/server/reports/report-service";
import { getUserFeatureAccess } from "@/server/membership/membership-access-service";

export type NotificationDispatchStats = {
  processedUsers: number;
  usersWithPendingNotifications: number;
  emailsQueued: number;
  emailsSkipped: number;
  notificationsMarkedSent: number;
  failedUsers: number;
};

type WeeklyProgressSignal = ReportSummaryDto["comparison"]["signal"];

const NOTIFICATION_SYNC_COOLDOWN_MS = 60_000;
const notificationSyncState = new Map<
  string,
  {
    lastCompletedAt: number;
    promise: Promise<NotificationItemDto[]> | null;
  }
>();

function buildWeeklyDigestCta(signal: "IMPROVING" | "STABLE" | "REGRESSION" | "NO_BASELINE") {
  const appUrl = getServerAppUrl();

  if (signal === "IMPROVING") {
    return {
      ctaLabel: "Sostener mi plan",
      ctaHref: `${appUrl}/dashboard?focus=optimization`,
    };
  }

  if (signal === "REGRESSION") {
    return {
      ctaLabel: "Corregir en simulador",
      ctaHref: `${appUrl}/simulador`,
    };
  }

  if (signal === "STABLE") {
    return {
      ctaLabel: "Revisar comparación",
      ctaHref: `${appUrl}/reportes`,
    };
  }

  return {
    ctaLabel: "Registrar mi primer pago",
    ctaHref: `${appUrl}/pagos`,
  };
}

export function buildPremiumWeeklyFollowUp(input: {
  signal: WeeklyProgressSignal;
  recommendedDebtName: string | null;
  selectedMonthlyBudget: number;
  defaultCurrency: "DOP" | "USD";
  monthsToPayoff: number | null;
}) {
  const debtLabel = input.recommendedDebtName ?? "tu deuda prioritaria";
  const budgetLabel = formatCurrency(input.selectedMonthlyBudget, input.defaultCurrency);
  const payoffWindow =
    input.monthsToPayoff !== null ? ` y sostener una salida proyectada en ${input.monthsToPayoff} meses` : "";

  if (input.signal === "IMPROVING") {
    return {
      severity: NotificationSeverity.INFO,
      title: "Buen avance premium esta semana",
      message: `${debtLabel} sigue siendo tu foco principal y tu flujo viene mejorando frente al período anterior. Si sostienes ${budgetLabel} este mes, mantienes la tracción${payoffWindow}.`,
    };
  }

  if (input.signal === "REGRESSION") {
    return {
      severity: NotificationSeverity.WARNING,
      title: "Tu plan perdió tracción esta semana",
      message: `Tu flujo perdió eficiencia frente al período anterior. Vuelve a concentrarte en ${debtLabel} y protege al menos ${budgetLabel} este mes para recuperar tracción${payoffWindow}.`,
    };
  }

  if (input.signal === "STABLE") {
    return {
      severity: NotificationSeverity.INFO,
      title: "Tu progreso premium sigue estable",
      message: `Tu avance sigue estable, pero todavía sin un salto claro. Mantén ${debtLabel} como foco y concentra ${budgetLabel} este mes para mover más capital${payoffWindow}.`,
    };
  }

  return {
    severity: NotificationSeverity.INFO,
    title: "Aún falta historial para medir tu avance",
    message: `Todavía faltan dos períodos comparables para medir tu ritmo. Usa ${debtLabel} como foco y registra los pagos de esta semana mientras sostienes ${budgetLabel} para construir esa base.`,
  };
}

function mapNotificationToDto(notification: {
  id: string;
  debtId: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  severity: NotificationSeverity;
  title: string;
  message: string;
  dueAt: Date | null;
  readAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}) {
  const action =
    notification.type === NotificationType.DUE_SOON || notification.type === NotificationType.OVERDUE
      ? {
          actionLabel: "Revisar deudas",
          actionHref: "/deudas",
        }
      : notification.type === NotificationType.MINIMUM_PAYMENT_RISK
        ? {
            actionLabel: "Abrir simulador",
            actionHref: "/simulador",
          }
        : notification.type === NotificationType.STRATEGY_RECOMMENDATION
          ? {
              actionLabel: "Ver plan",
              actionHref: "/dashboard?focus=optimization",
            }
          : notification.type === NotificationType.MONTHLY_REPORT
            ? {
                actionLabel: "Abrir reportes",
                actionHref: "/reportes",
              }
            : notification.type === NotificationType.SECURITY
              ? {
                  actionLabel: "Revisar seguridad",
                  actionHref: "/configuracion",
                }
              : {
                  actionLabel: null,
                  actionHref: null,
                };

  return {
    id: notification.id,
    debtId: notification.debtId,
    type: notification.type,
    channel: notification.channel,
    severity: notification.severity,
    title: notification.title,
    message: notification.message,
    actionLabel: action.actionLabel,
    actionHref: action.actionHref,
    dueAt: notification.dueAt?.toISOString() ?? null,
    readAt: notification.readAt?.toISOString() ?? null,
    sentAt: notification.sentAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  } satisfies NotificationItemDto;
}

async function ensureNotification(input: {
  userId: string;
  debtId?: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  dueAt?: Date;
  lookbackDays?: number;
}) {
  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      ...(input.debtId ? { debtId: input.debtId } : {}),
      type: input.type,
      title: input.title,
      readAt: null,
      createdAt: {
        gte: addDays(new Date(), -(input.lookbackDays ?? 3)),
      },
    },
  });

  if (existingNotification) {
    return existingNotification;
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      ...(input.debtId ? { debtId: input.debtId } : {}),
      type: input.type,
      channel: NotificationChannel.IN_APP,
      severity: input.severity,
      title: input.title,
      message: input.message,
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    },
  });
}

async function runNotificationSync(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      debts: {
        where: {
          archivedAt: null,
          status: {
            notIn: ["PAID", "ARCHIVED"],
          },
        },
      },
    },
  });

  if (!user || !user.settings) {
    return [];
  }

  const now = new Date();
  const dueSoonBoundary = addDays(now, user.settings.upcomingDueDays);
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const debtNotificationTasks: Array<Promise<unknown>> = [];

  for (const debt of user.debts) {
    if (
      user.settings.notifyDueSoon &&
      debt.nextDueDate &&
      debt.nextDueDate >= now &&
      debt.nextDueDate <= dueSoonBoundary
    ) {
      debtNotificationTasks.push(
        ensureNotification({
          userId: user.id,
          debtId: debt.id,
          type: NotificationType.DUE_SOON,
          severity: NotificationSeverity.WARNING,
          title: `Vence pronto: ${debt.name}`,
          message: `Tu deuda ${debt.name} vence pronto. Si pagas antes del ${debt.nextDueDate.toLocaleDateString("es-DO")}, evitas cargos y estrés adicional.`,
          dueAt: debt.nextDueDate,
        }),
      );
    }

    if (user.settings.notifyOverdue && debt.nextDueDate && debt.nextDueDate < now) {
      debtNotificationTasks.push(
        ensureNotification({
          userId: user.id,
          debtId: debt.id,
          type: NotificationType.OVERDUE,
          severity: NotificationSeverity.CRITICAL,
          title: `Atraso detectado en ${debt.name}`,
          message: `La deuda ${debt.name} está vencida. Conviene cubrirla primero para frenar mora y presión de caja.`,
          dueAt: debt.nextDueDate,
        }),
      );
    }

    if (user.settings.notifyMinimumRisk && isMinimumPaymentRisk(debt)) {
      debtNotificationTasks.push(
        ensureNotification({
          userId: user.id,
          debtId: debt.id,
          type: NotificationType.MINIMUM_PAYMENT_RISK,
          severity: NotificationSeverity.WARNING,
          title: `Riesgo de pagar solo mínimos en ${debt.name}`,
          message: `El pago mínimo de ${debt.name} está demasiado cerca del interés estimado del mes. Así tardarás mucho más en salir.`,
        }),
      );
    }
  }

  if (debtNotificationTasks.length > 0) {
    await Promise.all(debtNotificationTasks);
  }

  if (user.debts.length) {
    const strategy = calculateDebtStrategy(
      user.debts.map((debt) => ({
        id: debt.id,
        name: debt.name,
        type: debt.type,
        status: debt.status,
        currentBalance: debt.currentBalance,
        interestRate: debt.interestRate,
        interestRateType: debt.interestRateType,
        minimumPayment: debt.minimumPayment,
        lateFeeAmount: debt.lateFeeAmount,
        extraChargesAmount: debt.extraChargesAmount,
        nextDueDate: debt.nextDueDate,
      })),
      {
        strategy: user.settings.preferredStrategy,
        ...(user.settings.monthlyDebtBudget !== null &&
        user.settings.monthlyDebtBudget !== undefined
          ? { monthlyBudget: user.settings.monthlyDebtBudget }
          : {}),
        hybridRateWeight: user.settings.hybridRateWeight,
        hybridBalanceWeight: user.settings.hybridBalanceWeight,
      },
    );
    const recommendedDebt = strategy.recommendedOrder[0];
    const hasPremiumGuidance =
      user.settings.membershipBillingStatus === "ACTIVE" &&
      user.settings.membershipTier !== "FREE";
    const premiumFollowUp = hasPremiumGuidance
      ? buildPremiumWeeklyFollowUp({
          signal: (
            await getReportSummary(user.id, currentMonthStart, currentMonthEnd)
          ).comparison.signal,
          recommendedDebtName: recommendedDebt?.name ?? null,
          selectedMonthlyBudget: strategy.selectedMonthlyBudget,
          defaultCurrency: user.settings.defaultCurrency,
          monthsToPayoff: strategy.selectedPlan.monthsToPayoff,
        })
      : null;

    if (recommendedDebt) {
      await ensureNotification({
        userId: user.id,
        debtId: recommendedDebt.id,
        type: NotificationType.STRATEGY_RECOMMENDATION,
        severity: NotificationSeverity.INFO,
        title: `Prioridad sugerida: ${recommendedDebt.name}`,
        message: `Tu plan ${user.settings.preferredStrategy.toLowerCase()} indica atacar primero ${recommendedDebt.name}.`,
      });

      if (premiumFollowUp) {
        await ensureNotification({
          userId: user.id,
          debtId: recommendedDebt.id,
          type: NotificationType.STRATEGY_RECOMMENDATION,
          severity: premiumFollowUp.severity,
          title: premiumFollowUp.title,
          message: premiumFollowUp.message,
          lookbackDays: 7,
        });
      }
    }
  }

  if (user.settings.notifyMonthlyReport) {
    const monthlyPaymentCount = await prisma.payment.count({
      where: {
        userId: user.id,
        paidAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    });

    if (monthlyPaymentCount > 0) {
      await ensureNotification({
        userId: user.id,
        type: NotificationType.MONTHLY_REPORT,
        severity: NotificationSeverity.INFO,
        title: "Tu resumen mensual está listo",
        message: `Ya registraste ${monthlyPaymentCount} pago${monthlyPaymentCount === 1 ? "" : "s"} este mes. En reportes puedes ver cuánto fue a principal, intereses y cargos.`,
        dueAt: currentMonthEnd,
      });
    }
  }

  const notifications = await prisma.notification.findMany({
    where: {
      userId,
    },
    orderBy: [
      { readAt: "asc" },
      { createdAt: "desc" },
    ],
    take: 50,
  });

  return notifications.map(mapNotificationToDto);
}

export async function syncUserNotifications(
  userId: string,
  options?: { force?: boolean },
) {
  const state = notificationSyncState.get(userId);
  const now = Date.now();

  if (!options?.force) {
    if (state?.promise) {
      return state.promise;
    }

    if (
      state?.lastCompletedAt &&
      now - state.lastCompletedAt < NOTIFICATION_SYNC_COOLDOWN_MS
    ) {
      return [];
    }
  }

  const promise = runNotificationSync(userId)
    .then((result) => {
      notificationSyncState.set(userId, {
        lastCompletedAt: Date.now(),
        promise: null,
      });

      return result;
    })
    .catch((error) => {
      notificationSyncState.delete(userId);
      throw error;
    });

  notificationSyncState.set(userId, {
    lastCompletedAt: state?.lastCompletedAt ?? 0,
    promise,
  });

  return promise;
}

export async function listUserNotifications(userId: string) {
  await syncUserNotifications(userId);
  const access = await getUserFeatureAccess(userId);

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: [
      { readAt: "asc" },
      { createdAt: "desc" },
    ],
    take: access.notificationHistoryLimit,
  });

  return notifications.map(mapNotificationToDto);
}

export async function markNotificationAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new ServiceError("NOTIFICATION_NOT_FOUND", 404, "No se encontró la notificación.");
  }

  const readAt = notification.readAt ?? new Date();
  const updateResult = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: {
      readAt,
    },
  });

  if (updateResult.count !== 1) {
    throw new ServiceError("NOTIFICATION_NOT_FOUND", 404, "No se encontró la notificación.");
  }

  return mapNotificationToDto({
    ...notification,
    readAt,
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function dispatchPendingNotificationEmails() {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      settings: {
        emailRemindersEnabled: true,
      },
    },
    include: {
      settings: true,
      notifications: {
        where: {
          readAt: null,
          sentAt: null,
          type: {
            in: [
              NotificationType.DUE_SOON,
              NotificationType.OVERDUE,
              NotificationType.MINIMUM_PAYMENT_RISK,
              NotificationType.STRATEGY_RECOMMENDATION,
              NotificationType.MONTHLY_REPORT,
            ],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
  });

  const stats: NotificationDispatchStats = {
    processedUsers: users.length,
    usersWithPendingNotifications: 0,
    emailsQueued: 0,
    emailsSkipped: 0,
    notificationsMarkedSent: 0,
    failedUsers: 0,
  };

  for (const user of users) {
    if (!user.notifications.length) {
      continue;
    }

    stats.usersWithPendingNotifications += 1;

    try {
      const reportSummary = await getReportSummary(user.id, currentMonthStart, currentMonthEnd);
      const digest = buildNotificationDigest(
        user.notifications.map((notification) => {
          const action =
            notification.type === NotificationType.DUE_SOON ||
            notification.type === NotificationType.OVERDUE
              ? { actionLabel: "Revisar deudas", actionHref: `${getServerAppUrl()}/deudas` }
              : notification.type === NotificationType.MINIMUM_PAYMENT_RISK
                ? { actionLabel: "Abrir simulador", actionHref: `${getServerAppUrl()}/simulador` }
                : notification.type === NotificationType.STRATEGY_RECOMMENDATION
                  ? {
                      actionLabel: "Ver plan",
                      actionHref: `${getServerAppUrl()}/dashboard?focus=optimization`,
                    }
                  : notification.type === NotificationType.MONTHLY_REPORT
                    ? { actionLabel: "Abrir reportes", actionHref: `${getServerAppUrl()}/reportes` }
                    : { actionLabel: null, actionHref: null };

          return {
            title: notification.title,
            message: notification.message,
            severity: notification.severity,
            actionLabel: action.actionLabel,
            actionHref: action.actionHref,
          };
        }),
        reportSummary.paymentCount > 0
          ? {
              signal: reportSummary.comparison.signal,
              headline: reportSummary.coachingHeadline,
              support: `${reportSummary.coachingSummary} ${reportSummary.comparison.summary}`.trim(),
              nextStep: reportSummary.recommendedNextStep,
              ...buildWeeklyDigestCta(reportSummary.comparison.signal),
            }
          : {
              signal: reportSummary.comparison.signal,
              headline: reportSummary.comparison.headline,
              support: reportSummary.comparison.summary,
              nextStep: reportSummary.recommendedNextStep,
              ...buildWeeklyDigestCta(reportSummary.comparison.signal),
            },
      );

      const delivery = await sendTransactionalEmail({
        to: user.email,
        subject: digest.subject,
        html: digest.html,
        text: digest.text,
      });

      if (!delivery.queued) {
        stats.emailsSkipped += 1;
        continue;
      }

      stats.emailsQueued += 1;

      await prisma.notification.updateMany({
        where: {
          id: {
            in: user.notifications.map((notification) => notification.id),
          },
        },
        data: {
          sentAt: new Date(),
        },
      });

      stats.notificationsMarkedSent += user.notifications.length;
    } catch (error) {
      stats.failedUsers += 1;
      logServerError("Notification email dispatch failed", {
        userId: user.id,
        email: user.email,
        error,
      });
    }
  }

  return stats;
}

function getServerAppUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
