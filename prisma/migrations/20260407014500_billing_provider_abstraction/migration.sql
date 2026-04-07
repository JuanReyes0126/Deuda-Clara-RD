CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "BillingPaymentProvider" AS ENUM ('AZUL');
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELED', 'FAILED');
CREATE TYPE "BillingProviderEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');

ALTER TYPE "AuditAction" ADD VALUE 'BILLING_PAYMENT_CONFIRMED';

ALTER TABLE "UserSettings"
ADD COLUMN "billingInterval" "BillingInterval",
ADD COLUMN "externalPaymentProvider" "BillingPaymentProvider",
ADD COLUMN "externalCustomerId" TEXT,
ADD COLUMN "externalSubscriptionId" TEXT,
ADD COLUMN "externalPriceCode" TEXT;

CREATE UNIQUE INDEX "UserSettings_externalCustomerId_key" ON "UserSettings"("externalCustomerId");
CREATE UNIQUE INDEX "UserSettings_externalSubscriptionId_key" ON "UserSettings"("externalSubscriptionId");

CREATE TABLE "BillingPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BillingPaymentProvider" NOT NULL,
    "membershipTier" "MembershipTier" NOT NULL,
    "billingInterval" "BillingInterval" NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "externalTransactionId" TEXT,
    "externalCustomerId" TEXT,
    "externalPriceCode" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingPayment_externalOrderId_key" ON "BillingPayment"("externalOrderId");
CREATE INDEX "BillingPayment_userId_createdAt_idx" ON "BillingPayment"("userId", "createdAt");
CREATE INDEX "BillingPayment_provider_status_createdAt_idx" ON "BillingPayment"("provider", "status", "createdAt");
CREATE INDEX "BillingPayment_externalTransactionId_idx" ON "BillingPayment"("externalTransactionId");

ALTER TABLE "BillingPayment"
ADD CONSTRAINT "BillingPayment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingPaymentProvider" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "BillingProviderEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingProviderEvent_provider_externalEventId_key" ON "BillingProviderEvent"("provider", "externalEventId");
CREATE INDEX "BillingProviderEvent_status_createdAt_idx" ON "BillingProviderEvent"("status", "createdAt");
CREATE INDEX "BillingProviderEvent_provider_status_createdAt_idx" ON "BillingProviderEvent"("provider", "status", "createdAt");
CREATE INDEX "BillingProviderEvent_eventType_createdAt_idx" ON "BillingProviderEvent"("eventType", "createdAt");
