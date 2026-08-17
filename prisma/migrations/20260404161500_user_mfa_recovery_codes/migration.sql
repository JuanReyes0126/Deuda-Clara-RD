-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "mfaRecoveryCodesHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
