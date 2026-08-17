import { describe, expect, it } from "vitest";

import { preferencesSchema } from "@/lib/validations/profile";

const basePreferences = {
  defaultCurrency: "DOP" as const,
  preferredStrategy: "AVALANCHE" as const,
  hybridRateWeight: 70,
  hybridBalanceWeight: 30,
  monthlyIncome: 52000,
  monthlyHousingCost: 14000,
  monthlyGroceriesCost: 9000,
  monthlyUtilitiesCost: 3500,
  monthlyTransportCost: 4500,
  monthlyOtherEssentialExpenses: 2500,
  monthlyDebtBudget: 18000,
  notifyDueSoon: true,
  notifyOverdue: true,
  notifyMinimumRisk: true,
  notifyMonthlyReport: true,
  emailRemindersEnabled: true,
  preferredReminderDays: [5, 2, 0],
  preferredReminderHour: 8,
  upcomingDueDays: 3,
  timezone: "America/Santo_Domingo",
  language: "es" as const,
};

describe("preferencesSchema reminder fields", () => {
  it("acepta una configuración válida de recordatorios", () => {
    const parsed = preferencesSchema.safeParse(basePreferences);

    expect(parsed.success).toBe(true);
  });

  it("rechaza cuando no hay ningún día de recordatorio", () => {
    const parsed = preferencesSchema.safeParse({
      ...basePreferences,
      preferredReminderDays: [],
    });

    expect(parsed.success).toBe(false);
  });
});
