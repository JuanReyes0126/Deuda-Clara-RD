import { describe, expect, it } from "vitest";

import {
  buildReminderDispatchCandidates,
  buildUpcomingReminderTimeline,
} from "@/server/reminders/reminder-engine";

describe("reminder-engine", () => {
  it("detecta recordatorios pendientes para corte y pago sin duplicar lógica en cliente", () => {
    const now = new Date("2026-04-05T12:00:00.000Z");
    const candidates = buildReminderDispatchCandidates({
      userId: "user-1",
      settings: {
        timezone: "America/Santo_Domingo",
        preferredReminderDays: [5, 2, 0],
        preferredReminderHour: 8,
      },
      debts: [
        {
          id: "debt-1",
          name: "Tarjeta Gold",
          type: "CREDIT_CARD",
          currency: "DOP",
          minimumPayment: 5200,
          statementDay: 10,
          dueDay: 7,
          nextDueDate: null,
          notificationsEnabled: true,
        },
        {
          id: "debt-2",
          name: "Préstamo personal",
          type: "PERSONAL_LOAN",
          currency: "DOP",
          minimumPayment: 7800,
          statementDay: null,
          dueDay: 5,
          nextDueDate: null,
          notificationsEnabled: true,
        },
      ],
      now,
    });

    expect(candidates.some((candidate) => candidate.eventType === "STATEMENT_CLOSING")).toBe(true);
    expect(candidates.some((candidate) => candidate.eventType === "PAYMENT_DUE")).toBe(true);
    expect(candidates.some((candidate) => candidate.daysBefore === 5)).toBe(true);
    expect(candidates.some((candidate) => candidate.daysBefore === 2)).toBe(true);
    expect(candidates.some((candidate) => candidate.daysBefore === 0)).toBe(true);
  });

  it("arma una tarjeta de próximas fechas útil para dashboard", () => {
    const now = new Date("2026-04-05T12:00:00.000Z");
    const timeline = buildUpcomingReminderTimeline({
      settings: {
        timezone: "America/Santo_Domingo",
        preferredReminderDays: [5, 2, 0],
        preferredReminderHour: 8,
      },
      debts: [
        {
          id: "debt-1",
          name: "Tarjeta Gold",
          type: "CREDIT_CARD",
          currency: "DOP",
          minimumPayment: 5200,
          statementDay: 8,
          dueDay: 12,
          nextDueDate: null,
          notificationsEnabled: true,
        },
      ],
      now,
    });

    expect(timeline.headline).toBe("Siempre a tiempo");
    expect(timeline.items.length).toBeGreaterThan(0);
    expect(timeline.items[0]?.summary.length).toBeGreaterThan(0);
  });
});
