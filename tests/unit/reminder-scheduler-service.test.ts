import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindManyMock = vi.fn();
const notificationEventFindUniqueMock = vi.fn();
const notificationEventCreateMock = vi.fn();
const notificationEventUpdateMock = vi.fn();
const sendTransactionalEmailMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findMany: userFindManyMock,
    },
    notificationEvent: {
      findUnique: notificationEventFindUniqueMock,
      create: notificationEventCreateMock,
      update: notificationEventUpdateMock,
    },
  },
}));

vi.mock("@/server/mail/mail-service", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("@/server/observability/logger", () => ({
  logServerError: vi.fn(),
  logServerInfo: vi.fn(),
}));

describe("dispatchAutomatedReminderEmails", () => {
  beforeEach(() => {
    userFindManyMock.mockReset();
    notificationEventFindUniqueMock.mockReset();
    notificationEventCreateMock.mockReset();
    notificationEventUpdateMock.mockReset();
    sendTransactionalEmailMock.mockReset();
  });

  it("evita envíos duplicados cuando el NotificationEvent ya fue enviado", async () => {
    userFindManyMock.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "ana@example.com",
        firstName: "Ana",
        settings: {
          timezone: "America/Santo_Domingo",
          preferredReminderDays: [5],
          preferredReminderHour: 8,
        },
        debts: [
          {
            id: "debt-1",
            name: "Tarjeta Gold",
            type: "CREDIT_CARD",
            currency: "DOP",
            minimumPayment: 5200,
            statementDay: null,
            dueDay: 10,
            nextDueDate: null,
            notificationsEnabled: true,
          },
        ],
      },
    ]);
    notificationEventFindUniqueMock.mockResolvedValueOnce({
      id: "event-1",
      status: "SENT",
    });

    const { dispatchAutomatedReminderEmails } = await import(
      "@/server/reminders/reminder-scheduler-service"
    );

    const result = await dispatchAutomatedReminderEmails({
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(result.duplicatesPrevented).toBe(1);
  });

  it("envía el correo y registra el evento cuando corresponde", async () => {
    userFindManyMock.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "ana@example.com",
        firstName: "Ana",
        settings: {
          timezone: "America/Santo_Domingo",
          preferredReminderDays: [0],
          preferredReminderHour: 8,
        },
        debts: [
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
      },
    ]);
    notificationEventFindUniqueMock.mockResolvedValueOnce(null);
    notificationEventCreateMock.mockResolvedValueOnce({
      id: "event-2",
      payload: null,
    });
    notificationEventUpdateMock.mockResolvedValueOnce({
      id: "event-2",
      status: "SENT",
    });
    sendTransactionalEmailMock.mockResolvedValueOnce({ queued: true });

    const { dispatchAutomatedReminderEmails } = await import(
      "@/server/reminders/reminder-scheduler-service"
    );

    const result = await dispatchAutomatedReminderEmails({
      now: new Date("2026-04-05T12:00:00.000Z"),
    });

    expect(notificationEventCreateMock).toHaveBeenCalledOnce();
    expect(sendTransactionalEmailMock).toHaveBeenCalledOnce();
    expect(notificationEventUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SENT",
        }),
      }),
    );
    expect(result.eventsSent).toBe(1);
    expect(result.emailsQueued).toBe(1);
  });
});
