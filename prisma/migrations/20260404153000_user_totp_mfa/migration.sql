-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "mfaTotpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaTotpSecretEncrypted" TEXT;
