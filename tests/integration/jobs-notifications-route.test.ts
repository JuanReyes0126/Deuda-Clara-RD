import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/jobs/notifications/route";

vi.mock("@/lib/env/server", () => ({
  getServerEnv: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn(() => "cron-notifications-test-key"),
}));

vi.mock("@/server/notifications/notification-service", () => ({
  dispatchPendingNotificationEmails: vi.fn(),
}));

vi.mock("@/server/reminders/reminder-scheduler-service", () => ({
  dispatchAutomatedReminderEmails: vi.fn(),
}));

vi.mock("@/server/observability/logger", () => ({
  logSecurityEvent: vi.fn(),
}));

describe("api/jobs/notifications", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza la ejecución si el cron secret no coincide", async () => {
    const { getServerEnv } = await import("@/lib/env/server");
    const { dispatchAutomatedReminderEmails } = await import(
      "@/server/reminders/reminder-scheduler-service"
    );

    vi.mocked(getServerEnv).mockReturnValue({
      CRON_SECRET: "cron-secret",
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/jobs/notifications", {
        method: "POST",
        headers: {
          host: "localhost",
          "x-cron-secret": "secret-incorrecto",
        },
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("No autorizado.");
    expect(dispatchAutomatedReminderEmails).not.toHaveBeenCalled();
  });

  it("ejecuta recordatorios y digest cuando el cron está autorizado", async () => {
    const { getServerEnv } = await import("@/lib/env/server");
    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const { dispatchAutomatedReminderEmails } = await import(
      "@/server/reminders/reminder-scheduler-service"
    );
    const { dispatchPendingNotificationEmails } = await import(
      "@/server/notifications/notification-service"
    );

    vi.mocked(getServerEnv).mockReturnValue({
      CRON_SECRET: "cron-secret",
    } as never);
    vi.mocked(assertRateLimit).mockResolvedValueOnce({ success: true } as never);
    vi.mocked(dispatchAutomatedReminderEmails).mockResolvedValueOnce({
      processedUsers: 2,
      usersWithCandidates: 1,
      candidatesEvaluated: 3,
      emailsQueued: 2,
      eventsSent: 2,
      eventsSkipped: 0,
      eventsFailed: 0,
      duplicatesPrevented: 1,
    } as never);
    vi.mocked(dispatchPendingNotificationEmails).mockResolvedValueOnce({
      total: 1,
      sent: 1,
      failed: 0,
    } as never);

    const response = await POST(
      new NextRequest("http://localhost/api/jobs/notifications", {
        method: "POST",
        headers: {
          host: "localhost",
          "x-cron-secret": "cron-secret",
        },
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      stats: {
        reminders: { eventsSent: number; duplicatesPrevented: number };
        digests: { sent: number };
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.stats.reminders.eventsSent).toBe(2);
    expect(body.stats.reminders.duplicatesPrevented).toBe(1);
    expect(body.stats.digests.sent).toBe(1);
    expect(dispatchAutomatedReminderEmails).toHaveBeenCalledOnce();
    expect(dispatchPendingNotificationEmails).toHaveBeenCalledOnce();
  });
});
