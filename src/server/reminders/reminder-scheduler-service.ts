import {
  NotificationEventChannel,
  NotificationEventStatus,
  NotificationEventType,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { normalizeReminderDays } from "@/config/reminders";
import { buildDebtReminderEmail } from "@/server/mail/email-templates";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { logServerError, logServerInfo } from "@/server/observability/logger";
import { buildReminderDispatchCandidates } from "@/server/reminders/reminder-engine";

export type ReminderDispatchStats = {
  processedUsers: number;
  usersWithCandidates: number;
  candidatesEvaluated: number;
  emailsQueued: number;
  eventsSent: number;
  eventsSkipped: number;
  eventsFailed: number;
  duplicatesPrevented: number;
};

export async function dispatchAutomatedReminderEmails(input?: { now?: Date }) {
  const now = input?.now ?? new Date();
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      settings: {
        is: {
          emailRemindersEnabled: true,
        },
      },
      debts: {
        some: {
          archivedAt: null,
          status: {
            notIn: ["PAID", "ARCHIVED"],
          },
          notificationsEnabled: true,
        },
      },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      settings: {
        select: {
          timezone: true,
          preferredReminderDays: true,
          preferredReminderHour: true,
        },
      },
      debts: {
        where: {
          archivedAt: null,
          status: {
            notIn: ["PAID", "ARCHIVED"],
          },
          notificationsEnabled: true,
        },
        select: {
          id: true,
          name: true,
          type: true,
          currency: true,
          minimumPayment: true,
          statementDay: true,
          dueDay: true,
          nextDueDate: true,
          notificationsEnabled: true,
        },
      },
    },
  });

  const stats: ReminderDispatchStats = {
    processedUsers: users.length,
    usersWithCandidates: 0,
    candidatesEvaluated: 0,
    emailsQueued: 0,
    eventsSent: 0,
    eventsSkipped: 0,
    eventsFailed: 0,
    duplicatesPrevented: 0,
  };

  for (const user of users) {
    const candidates = buildReminderDispatchCandidates({
      userId: user.id,
      debts: user.debts.map((debt) => ({
        ...debt,
        minimumPayment: Number(debt.minimumPayment),
      })),
      settings: {
        timezone: user.settings?.timezone ?? "America/Santo_Domingo",
        preferredReminderDays: normalizeReminderDays(
          user.settings?.preferredReminderDays,
        ),
        preferredReminderHour: user.settings?.preferredReminderHour ?? 8,
      },
      now,
    });

    stats.candidatesEvaluated += candidates.length;

    if (!candidates.length) {
      continue;
    }

    stats.usersWithCandidates += 1;

    for (const candidate of candidates) {
      const existingEvent = await prisma.notificationEvent.findUnique({
        where: { dedupeKey: candidate.dedupeKey },
      });

      if (existingEvent?.status === NotificationEventStatus.SENT) {
        stats.duplicatesPrevented += 1;
        continue;
      }

      const event = existingEvent
        ? existingEvent
        : await prisma.notificationEvent.create({
            data: {
              userId: user.id,
              debtId: candidate.debtId,
              channel: NotificationEventChannel.EMAIL,
              eventType:
                candidate.eventType === "STATEMENT_CLOSING"
                  ? NotificationEventType.STATEMENT_CLOSING
                  : NotificationEventType.PAYMENT_DUE,
              scheduledFor: candidate.scheduledFor,
              status: NotificationEventStatus.PENDING,
              dedupeKey: candidate.dedupeKey,
              payload: {
                debtName: candidate.debtName,
                eventType: candidate.eventType,
                occursOn: candidate.occursOn.toISOString(),
                daysBefore: candidate.daysBefore,
              },
            },
          });

      const template = buildDebtReminderEmail({
        firstName: user.firstName,
        debtName: candidate.debtName,
        eventType: candidate.eventType,
        occursOn: candidate.occursOn,
        daysBefore: candidate.daysBefore,
        minimumPayment: candidate.minimumPayment,
        currency: candidate.currency,
        timeZone: user.settings?.timezone ?? "America/Santo_Domingo",
      });

      try {
        const delivery = await sendTransactionalEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        if (!delivery.queued) {
          await prisma.notificationEvent.update({
            where: { id: event.id },
            data: {
              status: NotificationEventStatus.SKIPPED,
              subject: template.subject,
              payload: {
                ...(event.payload as Record<string, unknown> | null),
                delivery: "skipped",
              },
            },
          });
          stats.eventsSkipped += 1;
          continue;
        }

        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: NotificationEventStatus.SENT,
            sentAt: now,
            subject: template.subject,
            payload: {
              ...(event.payload as Record<string, unknown> | null),
              delivery: "sent",
              summary: candidate.summary,
            },
          },
        });

        stats.emailsQueued += 1;
        stats.eventsSent += 1;
      } catch (error) {
        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: {
            status: NotificationEventStatus.FAILED,
            subject: template.subject,
            payload: {
              ...(event.payload as Record<string, unknown> | null),
              delivery: "failed",
            },
          },
        });

        stats.eventsFailed += 1;
        logServerError("Automated reminder email delivery failed", {
          userId: user.id,
          debtId: candidate.debtId,
          dedupeKey: candidate.dedupeKey,
          error,
        });
      }
    }
  }

  logServerInfo("Automated reminders processed", stats);

  return stats;
}
