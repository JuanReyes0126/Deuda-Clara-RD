import { AuditAction, BalanceSnapshotSource, CurrencyCode, DebtStatus, DebtType, InterestRateType, MembershipBillingStatus, NotificationChannel, NotificationSeverity, NotificationType, PaymentSource, PrismaClient, StrategyMethod, UserRole, UserStatus } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash("DeudaClara123!", {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@deudaclarard.com" },
    update: {},
    create: {
      email: "admin@deudaclarard.com",
      passwordHash,
      firstName: "Admin",
      lastName: "Sistema",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      onboardingCompleted: true,
      emailVerifiedAt: new Date(),
      settings: {
        create: {
          defaultCurrency: CurrencyCode.DOP,
          preferredStrategy: StrategyMethod.AVALANCHE,
          membershipTier: "PRO",
          membershipBillingStatus: MembershipBillingStatus.ACTIVE,
          membershipActivatedAt: new Date(),
          notifyDueSoon: true,
          notifyOverdue: true,
          notifyMinimumRisk: true,
          notifyMonthlyReport: true,
          emailRemindersEnabled: true,
          preferredReminderDays: [5, 2, 0],
          preferredReminderHour: 8,
          upcomingDueDays: 3,
        },
      },
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@deudaclarard.com" },
    update: {},
    create: {
      email: "demo@deudaclarard.com",
      passwordHash,
      firstName: "Carla",
      lastName: "Rodriguez",
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      onboardingCompleted: true,
      emailVerifiedAt: new Date(),
      settings: {
        create: {
          defaultCurrency: CurrencyCode.DOP,
          preferredStrategy: StrategyMethod.AVALANCHE,
          membershipTier: "NORMAL",
          membershipBillingStatus: MembershipBillingStatus.ACTIVE,
          membershipActivatedAt: new Date(),
          hybridRateWeight: 65,
          hybridBalanceWeight: 35,
          monthlyDebtBudget: "28000",
          notifyDueSoon: true,
          notifyOverdue: true,
          notifyMinimumRisk: true,
          notifyMonthlyReport: true,
          emailRemindersEnabled: true,
          preferredReminderDays: [5, 2, 0],
          preferredReminderHour: 8,
          upcomingDueDays: 5,
        },
      },
    },
  });

  const debts = await Promise.all([
    prisma.debt.upsert({
      where: { id: "seed-card-visa" },
      update: {},
      create: {
        id: "seed-card-visa",
        userId: user.id,
        name: "Tarjeta Visa principal",
        creditorName: "Banco Popular",
        type: DebtType.CREDIT_CARD,
        status: DebtStatus.CURRENT,
        currency: CurrencyCode.DOP,
        currentBalance: "128000",
        creditLimit: "180000",
        interestRate: "49.0000",
        interestRateType: InterestRateType.ANNUAL,
        minimumPayment: "8600",
        statementDay: 8,
        dueDay: 22,
        nextDueDate: new Date("2026-03-24T12:00:00.000Z"),
        lateFeeAmount: "0",
        extraChargesAmount: "0",
        notes: "Tarjeta principal usada para gastos recurrentes.",
        startedAt: new Date("2024-02-01T12:00:00.000Z"),
      },
    }),
    prisma.debt.upsert({
      where: { id: "seed-card-master" },
      update: {},
      create: {
        id: "seed-card-master",
        userId: user.id,
        name: "Tarjeta supermercado",
        creditorName: "Banreservas",
        type: DebtType.CREDIT_CARD,
        status: DebtStatus.LATE,
        currency: CurrencyCode.DOP,
        currentBalance: "46500",
        creditLimit: "60000",
        interestRate: "37.0000",
        interestRateType: InterestRateType.ANNUAL,
        minimumPayment: "3400",
        statementDay: 15,
        dueDay: 30,
        nextDueDate: new Date("2026-03-21T12:00:00.000Z"),
        lateFeeAmount: "850",
        extraChargesAmount: "0",
        notes: "Se atraso el pago del mes pasado.",
        startedAt: new Date("2025-05-16T12:00:00.000Z"),
      },
    }),
    prisma.debt.upsert({
      where: { id: "seed-loan-personal" },
      update: {},
      create: {
        id: "seed-loan-personal",
        userId: user.id,
        name: "Prestamo personal",
        creditorName: "Asociacion Cibao",
        type: DebtType.PERSONAL_LOAN,
        status: DebtStatus.CURRENT,
        currency: CurrencyCode.DOP,
        currentBalance: "218000",
        interestRate: "22.0000",
        interestRateType: InterestRateType.ANNUAL,
        minimumPayment: "9800",
        dueDay: 10,
        nextDueDate: new Date("2026-03-28T12:00:00.000Z"),
        lateFeeAmount: "0",
        extraChargesAmount: "0",
        notes: "Prestamo de consolidacion parcial tomado en 2025.",
        startedAt: new Date("2025-01-15T12:00:00.000Z"),
        estimatedEndAt: new Date("2028-01-15T12:00:00.000Z"),
      },
    }),
  ]);

  await prisma.payment.deleteMany({
    where: {
      debtId: {
        in: debts.map((debt) => debt.id),
      },
    },
  });

  await prisma.payment.createMany({
    data: [
      {
        userId: user.id,
        debtId: debts[0].id,
        amount: "8000",
        principalAmount: "4700",
        interestAmount: "3300",
        remainingBalanceAfter: "128000",
        source: PaymentSource.MANUAL,
        paidAt: new Date("2026-02-24T12:00:00.000Z"),
      },
      {
        userId: user.id,
        debtId: debts[1].id,
        amount: "3200",
        principalAmount: "2200",
        interestAmount: "700",
        lateFeeAmount: "300",
        extraChargesAmount: "0",
        remainingBalanceAfter: "46500",
        source: PaymentSource.MANUAL,
        paidAt: new Date("2026-02-27T12:00:00.000Z"),
      },
      {
        userId: user.id,
        debtId: debts[2].id,
        amount: "9800",
        principalAmount: "6100",
        interestAmount: "3700",
        remainingBalanceAfter: "218000",
        source: PaymentSource.MANUAL,
        paidAt: new Date("2026-03-01T12:00:00.000Z"),
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        debtId: debts[1].id,
        type: NotificationType.OVERDUE,
        channel: NotificationChannel.IN_APP,
        severity: NotificationSeverity.CRITICAL,
        title: "Pago atrasado detectado",
        message: "La Tarjeta supermercado tiene atraso y cargos de mora. Conviene atacarla antes del siguiente corte.",
      },
      {
        userId: user.id,
        debtId: debts[0].id,
        type: NotificationType.STRATEGY_RECOMMENDATION,
        channel: NotificationChannel.IN_APP,
        severity: NotificationSeverity.WARNING,
        title: "Recomendacion del sistema",
        message: "Con avalanche, atacar la Tarjeta Visa principal primero reduce intereses mas rapido.",
      },
    ],
  });

  await prisma.balanceSnapshot.create({
    data: {
      userId: user.id,
      totalBalance: "392500",
      totalMinimumPayment: "21800",
      totalMonthlyInterestEstimate: "11993",
      source: BalanceSnapshotSource.SEED,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: AuditAction.USER_REGISTERED,
        resourceType: "user",
        resourceId: user.id,
        metadata: { seeded: true },
      },
      {
        userId: user.id,
        debtId: debts[0].id,
        action: AuditAction.DEBT_CREATED,
        resourceType: "debt",
        resourceId: debts[0].id,
        metadata: { seeded: true },
      },
      {
        userId: user.id,
        debtId: debts[1].id,
        action: AuditAction.DEBT_CREATED,
        resourceType: "debt",
        resourceId: debts[1].id,
        metadata: { seeded: true },
      },
    ],
  });

  await prisma.emailTemplate.upsert({
    where: { key: "password-reset" },
    update: {},
    create: {
      key: "password-reset",
      name: "Recuperacion de contrasena",
      subject: "Restablece tu acceso a Deuda Clara RD",
      htmlContent: "<p>Usa el enlace seguro para restablecer tu contrasena.</p>",
      textContent: "Usa el enlace seguro para restablecer tu contrasena.",
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: "due-reminder" },
    update: {},
    create: {
      key: "due-reminder",
      name: "Recordatorio de vencimiento",
      subject: "Tienes un vencimiento cercano en Deuda Clara RD",
      htmlContent: "<p>Tienes un pago proximo. Revisa tu panel y evita mora.</p>",
      textContent: "Tienes un pago proximo. Revisa tu panel y evita mora.",
    },
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
