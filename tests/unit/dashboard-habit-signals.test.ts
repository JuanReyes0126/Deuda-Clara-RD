import { describe, expect, it } from "vitest";

import { buildDashboardHabitSignals } from "@/server/dashboard/dashboard-service";

describe("buildDashboardHabitSignals", () => {
  it("detecta racha semanal y momentum positivo", () => {
    const now = new Date("2026-04-08T12:00:00.000Z");
    const result = buildDashboardHabitSignals({
      hasDebts: true,
      payments: [
        { paidAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), amount: 3000 },
        { paidAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), amount: 2500 },
        { paidAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), amount: 2800 },
      ],
      riskAlertCount: 0,
      interestSavings: 4200,
      now,
    });

    expect(result.weeklyStreak).toBeGreaterThanOrEqual(1);
    expect(result.reviewPrompt).toBeNull();
    expect(result.momentumMessage.length).toBeGreaterThan(0);
    expect(result.microFeedback).toContain("intereses");
  });

  it("pide revisión cuando no hubo actividad reciente", () => {
    const now = new Date("2026-04-08T12:00:00.000Z");
    const result = buildDashboardHabitSignals({
      hasDebts: true,
      payments: [
        { paidAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000), amount: 2000 },
      ],
      riskAlertCount: 1,
      interestSavings: null,
      now,
    });

    expect(result.weeklyStreak).toBe(0);
    expect(result.reviewPrompt).toContain("Revisa tu plan esta semana");
    expect(result.microFeedback).toContain("No te atrases");
  });
});
