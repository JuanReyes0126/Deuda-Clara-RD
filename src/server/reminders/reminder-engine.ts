import { addMonths, differenceInCalendarDays, subDays, subHours } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

import { REMINDER_LOOKBACK_HOURS, normalizeReminderDays } from "@/config/reminders";
import type { DashboardDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";

type ReminderEligibleDebt = {
  id: string;
  name: string;
  type: string;
  currency: "DOP" | "USD";
  minimumPayment: number;
  statementDay: number | null;
  dueDay: number | null;
  nextDueDate: Date | string | null;
  notificationsEnabled: boolean;
};

type ReminderSettings = {
  timezone: string;
  preferredReminderDays: number[] | null | undefined;
  preferredReminderHour: number | null | undefined;
};

type ReminderOccurrence = {
  debtId: string;
  debtName: string;
  currency: "DOP" | "USD";
  minimumPayment: number;
  eventType: "PAYMENT_DUE" | "STATEMENT_CLOSING";
  occursOn: Date;
  eventLabel: string;
};

export type ReminderDispatchCandidate = ReminderOccurrence & {
  scheduledFor: Date;
  daysBefore: number;
  dedupeKey: string;
  summary: string;
};

type ReminderTimelineItem = DashboardDto["upcomingTimeline"]["items"][number];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getMonthLength(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampDayToMonth(year: number, month: number, day: number) {
  return Math.min(day, getMonthLength(year, month));
}

function buildUtcDateForTimezone(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  timeZone: string;
}) {
  return fromZonedTime(
    `${input.year}-${pad(input.month)}-${pad(input.day)}T${pad(input.hour)}:00:00`,
    input.timeZone,
  );
}

function getLocalCalendarKey(value: Date, timeZone: string) {
  return formatInTimeZone(value, timeZone, "yyyy-MM-dd");
}

function getCalendarDayDiff(later: Date, earlier: Date, timeZone: string) {
  return differenceInCalendarDays(
    new Date(`${getLocalCalendarKey(later, timeZone)}T00:00:00.000Z`),
    new Date(`${getLocalCalendarKey(earlier, timeZone)}T00:00:00.000Z`),
  );
}

function buildMonthlyOccurrenceDates(
  dayOfMonth: number,
  timeZone: string,
  preferredHour: number,
  now: Date,
) {
  const zonedNow = toZonedTime(now, timeZone);
  const currentYear = zonedNow.getFullYear();
  const currentMonth = zonedNow.getMonth() + 1;
  const nextMonthDate = addMonths(new Date(Date.UTC(currentYear, currentMonth - 1, 1)), 1);
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth() + 1;

  return [
    buildUtcDateForTimezone({
      year: currentYear,
      month: currentMonth,
      day: clampDayToMonth(currentYear, currentMonth, dayOfMonth),
      hour: preferredHour,
      timeZone,
    }),
    buildUtcDateForTimezone({
      year: nextYear,
      month: nextMonth,
      day: clampDayToMonth(nextYear, nextMonth, dayOfMonth),
      hour: preferredHour,
      timeZone,
    }),
  ];
}

function buildOneOffOccurrenceDate(
  value: Date | string,
  timeZone: string,
  preferredHour: number,
) {
  const source = new Date(value);
  const localDate = getLocalCalendarKey(source, timeZone);

  return fromZonedTime(`${localDate}T${pad(preferredHour)}:00:00`, timeZone);
}

function buildReminderSummary(input: {
  debtName: string;
  eventType: "PAYMENT_DUE" | "STATEMENT_CLOSING";
  daysBefore: number;
  minimumPayment: number;
  currency: "DOP" | "USD";
}) {
  if (input.eventType === "STATEMENT_CLOSING") {
    if (input.daysBefore === 0) {
      return `Hoy corta ${input.debtName}.`;
    }

    return `${input.debtName} corta en ${input.daysBefore} día${input.daysBefore === 1 ? "" : "s"}.`;
  }

  const paymentLabel = formatCurrency(input.minimumPayment, input.currency);

  if (input.daysBefore === 0) {
    return `Hoy vence ${input.debtName}. Procura cubrir al menos ${paymentLabel}.`;
  }

  return `${input.debtName} vence en ${input.daysBefore} día${
    input.daysBefore === 1 ? "" : "s"
  }. Procura cubrir al menos ${paymentLabel}.`;
}

function buildReminderOccurrencesForDebt(
  debt: ReminderEligibleDebt,
  settings: ReminderSettings,
  now: Date,
) {
  if (!debt.notificationsEnabled) {
    return [] as ReminderOccurrence[];
  }

  const preferredHour = settings.preferredReminderHour ?? 8;
  const occurrences: ReminderOccurrence[] = [];

  if (debt.type === "CREDIT_CARD" && debt.statementDay) {
    for (const occursOn of buildMonthlyOccurrenceDates(
      debt.statementDay,
      settings.timezone,
      preferredHour,
      now,
    )) {
      occurrences.push({
        debtId: debt.id,
        debtName: debt.name,
        currency: debt.currency,
        minimumPayment: debt.minimumPayment,
        eventType: "STATEMENT_CLOSING",
        occursOn,
        eventLabel: "Fecha de corte",
      });
    }
  }

  if (debt.dueDay) {
    for (const occursOn of buildMonthlyOccurrenceDates(
      debt.dueDay,
      settings.timezone,
      preferredHour,
      now,
    )) {
      occurrences.push({
        debtId: debt.id,
        debtName: debt.name,
        currency: debt.currency,
        minimumPayment: debt.minimumPayment,
        eventType: "PAYMENT_DUE",
        occursOn,
        eventLabel:
          debt.type === "CREDIT_CARD" ? "Fecha límite de pago" : "Fecha de pago",
      });
    }
  } else if (debt.nextDueDate) {
    const occursOn = buildOneOffOccurrenceDate(
      debt.nextDueDate,
      settings.timezone,
      preferredHour,
    );

    occurrences.push({
      debtId: debt.id,
      debtName: debt.name,
      currency: debt.currency,
      minimumPayment: debt.minimumPayment,
      eventType: "PAYMENT_DUE",
      occursOn,
      eventLabel:
        debt.type === "CREDIT_CARD" ? "Fecha límite de pago" : "Fecha de pago",
    });
  }

  return occurrences;
}

export function buildReminderDispatchCandidates(input: {
  userId: string;
  debts: ReminderEligibleDebt[];
  settings: ReminderSettings;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const preferredReminderDays = normalizeReminderDays(input.settings.preferredReminderDays);
  const windowStart = subHours(now, REMINDER_LOOKBACK_HOURS);
  const candidates: ReminderDispatchCandidate[] = [];

  for (const debt of input.debts) {
    const occurrences = buildReminderOccurrencesForDebt(debt, input.settings, now);

    for (const occurrence of occurrences) {
      for (const daysBefore of preferredReminderDays) {
        const scheduledFor = subDays(occurrence.occursOn, daysBefore);

        if (scheduledFor > now || scheduledFor < windowStart) {
          continue;
        }

        const occursOnKey = getLocalCalendarKey(occurrence.occursOn, input.settings.timezone);

        candidates.push({
          ...occurrence,
          scheduledFor,
          daysBefore,
          dedupeKey: [
            input.userId,
            occurrence.debtId,
            occurrence.eventType,
            occursOnKey,
            daysBefore,
            "EMAIL",
          ].join(":"),
          summary: buildReminderSummary({
            debtName: occurrence.debtName,
            eventType: occurrence.eventType,
            daysBefore,
            minimumPayment: occurrence.minimumPayment,
            currency: occurrence.currency,
          }),
        });
      }
    }
  }

  return candidates.sort(
    (left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime(),
  );
}

export function buildUpcomingReminderTimeline(input: {
  debts: ReminderEligibleDebt[];
  settings: ReminderSettings;
  now?: Date;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const occurrences = input.debts.flatMap((debt) =>
    buildReminderOccurrencesForDebt(debt, input.settings, now),
  );

  const items = occurrences
    .map((occurrence) => {
      const daysUntil = getCalendarDayDiff(
        occurrence.occursOn,
        now,
        input.settings.timezone,
      );

      return {
        debtId: occurrence.debtId,
        debtName: occurrence.debtName,
        eventType: occurrence.eventType,
        eventLabel: occurrence.eventLabel,
        occursOn: occurrence.occursOn.toISOString(),
        daysUntil,
        summary:
          occurrence.eventType === "STATEMENT_CLOSING"
            ? daysUntil === 0
              ? `${occurrence.debtName} corta hoy.`
              : `${occurrence.debtName} corta en ${daysUntil} día${daysUntil === 1 ? "" : "s"}.`
            : daysUntil === 0
              ? `${occurrence.debtName} vence hoy.`
              : daysUntil === 1
                ? `${occurrence.debtName} vence mañana.`
                : `${occurrence.debtName} vence en ${daysUntil} días.`,
      } satisfies ReminderTimelineItem;
    })
    .filter((item) => item.daysUntil >= 0)
    .sort((left, right) => {
      if (left.daysUntil !== right.daysUntil) {
        return left.daysUntil - right.daysUntil;
      }

      return left.debtName.localeCompare(right.debtName, "es");
    })
    .slice(0, input.limit ?? 3);

  return {
    headline: "Siempre a tiempo",
    support:
      items.length > 0
        ? `Tienes ${items.length} fecha${items.length === 1 ? "" : "s"} importante${
            items.length === 1 ? "" : "s"
          } cerca.`
        : "Agrega fechas de corte y pago para recibir recordatorios a tiempo.",
    items,
    emptyState:
      items.length === 0
        ? "Agrega fechas de corte y pago para recibir recordatorios a tiempo."
        : null,
  };
}
