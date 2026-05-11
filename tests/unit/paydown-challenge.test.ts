import { describe, expect, it } from "vitest";

import {
  PAYDOWN_CHALLENGE_TOTAL_DAYS,
  buildPaydownChallengeDto,
} from "@/server/dashboard/paydown-challenge";

describe("buildPaydownChallengeDto", () => {
  it("retorna estado none cuando no hay reto configurado", () => {
    const result = buildPaydownChallengeDto(null, [], new Date("2026-04-27T12:00:00.000Z"));

    expect(result).toEqual({
      state: "none",
      startedAt: null,
      endsAt: null,
      extraMonthly: null,
      daysRemaining: null,
      totalDays: PAYDOWN_CHALLENGE_TOTAL_DAYS,
      paymentsLoggedDuringChallenge: 0,
    });
  });

  it("retorna estado active con dias restantes y pagos hasta hoy", () => {
    const startedAt = new Date("2026-04-01T00:00:00.000Z");
    const endsAt = new Date("2026-05-01T00:00:00.000Z");
    const now = new Date("2026-04-15T12:00:00.000Z");

    const result = buildPaydownChallengeDto(
      {
        paydownChallengeStartedAt: startedAt,
        paydownChallengeEndsAt: endsAt,
        paydownChallengeExtraMonthly: 1500,
      },
      [
        { paidAt: new Date("2026-03-31T23:00:00.000Z") },
        { paidAt: new Date("2026-04-03T10:00:00.000Z") },
        { paidAt: new Date("2026-04-10T10:00:00.000Z") },
        { paidAt: new Date("2026-04-20T10:00:00.000Z") },
      ],
      now,
    );

    expect(result.state).toBe("active");
    expect(result.startedAt).toBe(startedAt.toISOString());
    expect(result.endsAt).toBe(endsAt.toISOString());
    expect(result.extraMonthly).toBe(1500);
    expect(result.totalDays).toBe(PAYDOWN_CHALLENGE_TOTAL_DAYS);
    expect(result.daysRemaining).toBe(15);
    expect(result.paymentsLoggedDuringChallenge).toBe(2);
  });

  it("retorna estado ended y cuenta pagos en toda la ventana", () => {
    const startedAt = new Date("2026-03-01T00:00:00.000Z");
    const endsAt = new Date("2026-03-31T00:00:00.000Z");
    const now = new Date("2026-04-15T12:00:00.000Z");

    const result = buildPaydownChallengeDto(
      {
        paydownChallengeStartedAt: startedAt,
        paydownChallengeEndsAt: endsAt,
        paydownChallengeExtraMonthly: 800,
      },
      [
        { paidAt: new Date("2026-02-28T12:00:00.000Z") },
        { paidAt: new Date("2026-03-02T12:00:00.000Z") },
        { paidAt: new Date("2026-03-15T12:00:00.000Z") },
        { paidAt: new Date("2026-03-31T00:00:00.000Z") },
        { paidAt: new Date("2026-04-01T12:00:00.000Z") },
      ],
      now,
    );

    expect(result.state).toBe("ended");
    expect(result.daysRemaining).toBe(0);
    expect(result.totalDays).toBe(PAYDOWN_CHALLENGE_TOTAL_DAYS);
    expect(result.paymentsLoggedDuringChallenge).toBe(3);
  });
});
