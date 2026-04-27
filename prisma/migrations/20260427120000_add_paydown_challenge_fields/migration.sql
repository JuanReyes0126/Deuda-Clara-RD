ALTER TABLE "UserSettings"
ADD COLUMN "paydownChallengeStartedAt" TIMESTAMP(3),
ADD COLUMN "paydownChallengeEndsAt" TIMESTAMP(3),
ADD COLUMN "paydownChallengeExtraMonthly" DECIMAL(14, 2);
