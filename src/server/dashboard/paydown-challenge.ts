import { differenceInCalendarDays } from "date-fns";

import type { DashboardPaydownChallengeDto } from "@/lib/types/app";
import { type DecimalLike, toMoneyNumber } from "@/lib/utils/decimal";

export const PAYDOWN_CHALLENGE_TOTAL_DAYS = 30;

type ChallengeSettings = {
  paydownChallengeStartedAt: Date | null;
  paydownChallengeEndsAt: Date | null;
  paydownChallengeExtraMonthly: { toNumber(): number } | number | null;
};

export function buildPaydownChallengeDto(
  settings: ChallengeSettings | null | undefined,
  payments: Array<{ paidAt: Date }>,
  now: Date = new Date(),
): DashboardPaydownChallengeDto {
  const startedAt = settings?.paydownChallengeStartedAt ?? null;
  const endsAt = settings?.paydownChallengeEndsAt ?? null;
  const rawExtra = settings?.paydownChallengeExtraMonthly;
  const extraMonthly =
    rawExtra === null || rawExtra === undefined
      ? null
      : typeof rawExtra === "number"
        ? rawExtra
        : toMoneyNumber(rawExtra as DecimalLike);

  if (!startedAt || !endsAt || extraMonthly === null || extraMonthly <= 0) {
    return {
      state: "none",
      startedAt: null,
      endsAt: null,
      extraMonthly: null,
      daysRemaining: null,
      totalDays: PAYDOWN_CHALLENGE_TOTAL_DAYS,
      paymentsLoggedDuringChallenge: 0,
    };
  }

  const paymentsLoggedDuringChallenge = payments.filter(
    (p) => p.paidAt >= startedAt && p.paidAt <= endsAt,
  ).length;

  if (now > endsAt) {
    return {
      state: "ended",
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      extraMonthly,
      daysRemaining: 0,
      totalDays: PAYDOWN_CHALLENGE_TOTAL_DAYS,
      paymentsLoggedDuringChallenge,
    };
  }

  const daysRemaining = Math.max(
    0,
    differenceInCalendarDays(endsAt, now),
  );

  return {
    state: "active",
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    extraMonthly,
    daysRemaining,
    totalDays: PAYDOWN_CHALLENGE_TOTAL_DAYS,
    paymentsLoggedDuringChallenge: payments.filter(
      (p) => p.paidAt >= startedAt && p.paidAt <= now,
    ).length,
  };
}
