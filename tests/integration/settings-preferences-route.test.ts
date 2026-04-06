import { afterEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/settings/preferences/route";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/settings/settings-service", () => ({
  updateUserPreferences: vi.fn(),
}));

const validPreferencesPayload = {
  defaultCurrency: "DOP" as const,
  preferredStrategy: "AVALANCHE" as const,
  hybridRateWeight: 60,
  hybridBalanceWeight: 40,
  monthlyDebtBudget: 28000,
  notifyDueSoon: true,
  notifyOverdue: true,
  notifyMinimumRisk: true,
  notifyMonthlyReport: true,
  emailRemindersEnabled: true,
  preferredReminderDays: [5, 2, 0],
  preferredReminderHour: 8,
  upcomingDueDays: 7,
  timezone: "America/Santo_Domingo",
  language: "es" as const,
};

describe("api/settings/preferences", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("actualiza recordatorios y alertas del usuario", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { updateUserPreferences } = await import("@/server/settings/settings-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(updateUserPreferences).mockResolvedValueOnce({
      ...validPreferencesPayload,
      firstName: "Ana",
      lastName: "Perez",
    } as never);

    const response = await PATCH(
      buildJsonRequest(
        "http://localhost/api/settings/preferences",
        validPreferencesPayload,
        { method: "PATCH" },
      ),
    );
    const body = (await response.json()) as {
      ok: boolean;
      settings: { preferredReminderDays: number[]; preferredReminderHour: number };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.settings.preferredReminderDays).toEqual([5, 2, 0]);
    expect(body.settings.preferredReminderHour).toBe(8);
    expect(updateUserPreferences).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        preferredReminderDays: [5, 2, 0],
        preferredReminderHour: 8,
        emailRemindersEnabled: true,
      }),
      {
        ipAddress: undefined,
        userAgent: undefined,
      },
    );
  });

  it("rechaza preferencias sin días de recordatorio", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { updateUserPreferences } = await import("@/server/settings/settings-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);

    const response = await PATCH(
      buildJsonRequest(
        "http://localhost/api/settings/preferences",
        {
          ...validPreferencesPayload,
          preferredReminderDays: [],
        },
        { method: "PATCH" },
      ),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Debes elegir al menos un recordatorio.");
    expect(updateUserPreferences).not.toHaveBeenCalled();
  });
});
