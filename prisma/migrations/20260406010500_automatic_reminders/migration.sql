-- CreateEnum
CREATE TYPE "NotificationEventChannel" AS ENUM ('EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('PAYMENT_DUE', 'STATEMENT_CLOSING', 'WEEKLY_SUMMARY');

-- CreateEnum
CREATE TYPE "NotificationEventStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Debt"
ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "preferredReminderDays" INTEGER[] NOT NULL DEFAULT ARRAY[5, 2, 0]::INTEGER[],
ADD COLUMN "preferredReminderHour" INTEGER NOT NULL DEFAULT 8;

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debtId" TEXT,
    "channel" "NotificationEventChannel" NOT NULL,
    "eventType" "NotificationEventType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "NotificationEventStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT,
    "payload" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationEvent_userId_scheduledFor_idx" ON "NotificationEvent"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationEvent_status_scheduledFor_idx" ON "NotificationEvent"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationEvent_debtId_scheduledFor_idx" ON "NotificationEvent"("debtId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
