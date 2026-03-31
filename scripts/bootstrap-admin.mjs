import {
  CurrencyCode,
  MembershipBillingStatus,
  MembershipTier,
  PrismaClient,
  StrategyMethod,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function requiredPassword(value) {
  if (!value || value.length < 8) {
    throw new Error("HOST_ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }

  return value;
}

async function main() {
  const email = normalizeEmail(
    process.env.HOST_ADMIN_EMAIL ?? "admin@deudaclarard.com",
  );
  const password = requiredPassword(
    process.env.HOST_ADMIN_PASSWORD ?? "DeudaClara123!",
  );
  const firstName = process.env.HOST_ADMIN_FIRST_NAME?.trim() || "Admin";
  const lastName = process.env.HOST_ADMIN_LAST_NAME?.trim() || "Sistema";

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      onboardingCompleted: true,
      emailVerifiedAt: now,
    },
    create: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      onboardingCompleted: true,
      emailVerifiedAt: now,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {
      defaultCurrency: CurrencyCode.DOP,
      preferredStrategy: StrategyMethod.AVALANCHE,
      membershipTier: MembershipTier.PRO,
      membershipBillingStatus: MembershipBillingStatus.ACTIVE,
      membershipActivatedAt: now,
      notifyDueSoon: true,
      notifyOverdue: true,
      notifyMinimumRisk: true,
      notifyMonthlyReport: true,
      emailRemindersEnabled: true,
      upcomingDueDays: 3,
    },
    create: {
      userId: user.id,
      defaultCurrency: CurrencyCode.DOP,
      preferredStrategy: StrategyMethod.AVALANCHE,
      membershipTier: MembershipTier.PRO,
      membershipBillingStatus: MembershipBillingStatus.ACTIVE,
      membershipActivatedAt: now,
      notifyDueSoon: true,
      notifyOverdue: true,
      notifyMinimumRisk: true,
      notifyMonthlyReport: true,
      emailRemindersEnabled: true,
      upcomingDueDays: 3,
    },
  });

  console.log("Host admin listo.");
  console.log(`EMAIL=${email}`);
  console.log(`PASSWORD=${password}`);
  console.log("ROL=ADMIN");
  console.log(`HOST_ALLOWED_EMAILS=${email}`);
}

main()
  .catch((error) => {
    console.error("No pudimos preparar el usuario host/admin.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
