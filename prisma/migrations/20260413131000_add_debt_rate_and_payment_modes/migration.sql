CREATE TYPE "InterestRateMode" AS ENUM ('FIXED', 'VARIABLE');

CREATE TYPE "PaymentAmountType" AS ENUM ('FIXED', 'VARIABLE');

ALTER TABLE "Debt"
ADD COLUMN "interestRateMode" "InterestRateMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "paymentAmountType" "PaymentAmountType" NOT NULL DEFAULT 'FIXED';
