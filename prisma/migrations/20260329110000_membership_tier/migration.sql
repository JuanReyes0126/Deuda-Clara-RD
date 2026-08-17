-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('FREE', 'NORMAL', 'PRO');

-- AlterTable
ALTER TABLE "UserSettings"
ADD COLUMN "membershipTier" "MembershipTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN "membershipActivatedAt" TIMESTAMP(3);
