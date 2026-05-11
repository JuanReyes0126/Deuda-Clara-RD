import { addDays } from "date-fns";

import { prisma } from "@/lib/db/prisma";
import { ServiceError } from "@/server/services/service-error";

import { PAYDOWN_CHALLENGE_TOTAL_DAYS } from "@/server/dashboard/paydown-challenge";

export async function startPaydownChallenge(userId: string, extraMonthly: number) {
  if (!Number.isFinite(extraMonthly) || extraMonthly <= 0) {
    throw new ServiceError(
      "INVALID_AMOUNT",
      400,
      "Indica un monto extra mensual mayor que cero.",
    );
  }

  if (extraMonthly > 999_999_999) {
    throw new ServiceError("INVALID_AMOUNT", 400, "El monto es demasiado alto.");
  }

  const now = new Date();

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      paydownChallengeStartedAt: now,
      paydownChallengeEndsAt: addDays(now, PAYDOWN_CHALLENGE_TOTAL_DAYS),
      paydownChallengeExtraMonthly: extraMonthly,
    },
    update: {
      paydownChallengeStartedAt: now,
      paydownChallengeEndsAt: addDays(now, PAYDOWN_CHALLENGE_TOTAL_DAYS),
      paydownChallengeExtraMonthly: extraMonthly,
    },
  });
}

export async function clearPaydownChallenge(userId: string) {
  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      paydownChallengeStartedAt: null,
      paydownChallengeEndsAt: null,
      paydownChallengeExtraMonthly: null,
    },
    update: {
      paydownChallengeStartedAt: null,
      paydownChallengeEndsAt: null,
      paydownChallengeExtraMonthly: null,
    },
  });
}
