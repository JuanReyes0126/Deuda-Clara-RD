import { AuditAction, BalanceSnapshotSource, DebtStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  createDemoDebt,
  deleteDemoDebt,
  getDemoDebtById,
  getDemoDebtSummary,
  listDemoDebts,
  updateDemoDebt,
} from "@/lib/demo/debts";
import { deleteDemoPaymentsForDebt } from "@/lib/demo/payments";
import { isDemoSessionUser } from "@/lib/demo/session";
import { canAddMoreDebts } from "@/lib/feature-access";
import { encryptSensitiveText } from "@/lib/security/encryption";
import type { DebtInput } from "@/lib/validations/debts";
import type {
  DebtItemDto,
  DebtSummaryDto,
} from "@/lib/types/app";
import { decimal, toMoneyNumber } from "@/lib/utils/decimal";
import { createAuditLog } from "@/server/audit/audit-service";
import {
  deriveDebtStatus,
  getDebtMonthlyRate,
  mapDebtToDto,
} from "@/server/finance/debt-helpers";
import { getUserFeatureAccess } from "@/server/membership/membership-access-service";
import { captureBalanceSnapshot } from "@/server/snapshots/balance-snapshot-service";

import { ServiceError } from "../services/service-error";

async function getUserDebtRecord(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirst({
    where: {
      id: debtId,
      userId,
    },
    include: {
      payments: {
        orderBy: {
          paidAt: "desc",
        },
      },
    },
  });

  if (!debt) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  return debt;
}

function isActiveDebtState(input: {
  status: DebtStatus;
  archivedAt: Date | null;
}) {
  return (
    input.archivedAt === null &&
    input.status !== DebtStatus.PAID &&
    input.status !== DebtStatus.ARCHIVED
  );
}

async function assertDebtLimit(input: {
  userId: string;
  nextDebtWillBeActive: boolean;
  activeDebtCountDelta?: number;
}) {
  if (!input.nextDebtWillBeActive) {
    return;
  }

  const [access, activeDebtCount] = await Promise.all([
    getUserFeatureAccess(input.userId),
    prisma.debt.count({
      where: {
        userId: input.userId,
        archivedAt: null,
        status: {
          notIn: [DebtStatus.PAID, DebtStatus.ARCHIVED],
        },
      },
    }),
  ]);
  const effectiveActiveDebtCount =
    activeDebtCount + (input.activeDebtCountDelta ?? 0);

  if (
    canAddMoreDebts({
      membershipTier: access.effectiveTier,
      membershipBillingStatus: access.billingStatus,
      activeDebtCount: effectiveActiveDebtCount,
    })
  ) {
    return;
  }

  throw new ServiceError(
    "DEBT_LIMIT_REACHED",
    403,
    access.isBase
      ? `Tienes más de ${access.maxActiveDebts} deudas activas. Estás viendo solo una parte de tu situación financiera. Desbloquea Premium para ver tu panorama completo.`
      : `Tu plan ${access.isPro ? "Pro" : "Premium"} permite hasta ${access.maxActiveDebts} deudas activas.`,
  );
}

export async function listUserDebts(userId: string, includeArchived = true) {
  if (isDemoSessionUser({ id: userId })) {
    return listDemoDebts(includeArchived);
  }

  const debts = await prisma.debt.findMany({
    where: {
      userId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    include: {
      payments: {
        orderBy: {
          paidAt: "desc",
        },
      },
    },
    orderBy: [
      { archivedAt: "asc" },
      { nextDueDate: "asc" },
      { createdAt: "desc" },
    ],
  });

  return debts.map(mapDebtToDto);
}

export async function getDebtSummary(userId: string): Promise<DebtSummaryDto> {
  if (isDemoSessionUser({ id: userId })) {
    return getDemoDebtSummary();
  }

  const debts = await prisma.debt.findMany({
    where: {
      userId,
    },
  });

  const summary = debts.reduce(
    (accumulator, debt) => {
      const effectiveBalance = decimal(debt.currentBalance)
        .plus(debt.lateFeeAmount)
        .plus(debt.extraChargesAmount);
      const monthlyInterest = decimal(debt.currentBalance).mul(
        getDebtMonthlyRate(debt.interestRate, debt.interestRateType),
      );

      return {
        activeDebtCount:
          debt.archivedAt || debt.status === DebtStatus.ARCHIVED ? accumulator.activeDebtCount : accumulator.activeDebtCount + 1,
        archivedDebtCount:
          debt.archivedAt || debt.status === DebtStatus.ARCHIVED
            ? accumulator.archivedDebtCount + 1
            : accumulator.archivedDebtCount,
        totalBalance: accumulator.totalBalance.plus(effectiveBalance),
        totalMinimumPayment: accumulator.totalMinimumPayment.plus(debt.minimumPayment),
        totalMonthlyInterest: accumulator.totalMonthlyInterest.plus(monthlyInterest),
        overdueCount:
          debt.status === DebtStatus.LATE ? accumulator.overdueCount + 1 : accumulator.overdueCount,
      };
    },
    {
      activeDebtCount: 0,
      archivedDebtCount: 0,
      totalBalance: decimal(0),
      totalMinimumPayment: decimal(0),
      totalMonthlyInterest: decimal(0),
      overdueCount: 0,
    },
  );

  return {
    activeDebtCount: summary.activeDebtCount,
    archivedDebtCount: summary.archivedDebtCount,
    totalBalance: toMoneyNumber(summary.totalBalance),
    totalMinimumPayment: toMoneyNumber(summary.totalMinimumPayment),
    totalMonthlyInterest: toMoneyNumber(summary.totalMonthlyInterest),
    overdueCount: summary.overdueCount,
  };
}

export async function createDebt(
  userId: string,
  input: DebtInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (isDemoSessionUser({ id: userId })) {
    return createDemoDebt(input);
  }

  const currentBalance = decimal(input.currentBalance);
  const lateFeeAmount = decimal(input.lateFeeAmount);
  const extraChargesAmount = decimal(input.extraChargesAmount);
  const archivedAt = input.status === DebtStatus.ARCHIVED ? new Date() : null;
  const status = deriveDebtStatus({
    currentBalance,
    lateFeeAmount,
    extraChargesAmount,
    archivedAt,
    preferredStatus: input.status,
    nextDueDate: input.nextDueDate,
  });

  await assertDebtLimit({
    userId,
    nextDebtWillBeActive: isActiveDebtState({ status, archivedAt }),
  });

  const debt = await prisma.debt.create({
    data: {
      userId,
      name: input.name,
      creditorName: input.creditorName,
      type: input.type,
      status,
      currency: input.currency,
      currentBalance,
      creditLimit: input.creditLimit ?? null,
      interestRate: input.interestRate,
      interestRateType: input.interestRateType,
      minimumPayment: input.minimumPayment,
      statementDay: input.statementDay ?? null,
      dueDay: input.dueDay ?? null,
      nextDueDate: input.nextDueDate ?? null,
      notificationsEnabled: input.notificationsEnabled,
      lateFeeAmount,
      extraChargesAmount,
      notes: encryptSensitiveText(input.notes),
      startedAt: input.startedAt ?? null,
      estimatedEndAt: input.estimatedEndAt ?? null,
      archivedAt,
      paidOffAt: status === DebtStatus.PAID ? new Date() : null,
    },
    include: {
      payments: true,
    },
  });

  await createAuditLog({
    userId,
    debtId: debt.id,
    action: AuditAction.DEBT_CREATED,
    resourceType: "debt",
    resourceId: debt.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  await captureBalanceSnapshot(userId, BalanceSnapshotSource.MUTATION);

  return mapDebtToDto(debt);
}

export async function updateDebt(
  userId: string,
  debtId: string,
  input: DebtInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (isDemoSessionUser({ id: userId })) {
    return updateDemoDebt(debtId, input);
  }

  const existingDebt = await getUserDebtRecord(userId, debtId);
  const currentBalance = decimal(input.currentBalance);
  const lateFeeAmount = decimal(input.lateFeeAmount);
  const extraChargesAmount = decimal(input.extraChargesAmount);
  const archivedAt =
    input.status === DebtStatus.ARCHIVED
      ? existingDebt.archivedAt ?? new Date()
      : null;
  const status = deriveDebtStatus({
    currentBalance,
    lateFeeAmount,
    extraChargesAmount,
    archivedAt,
    preferredStatus: input.status,
    nextDueDate: input.nextDueDate,
  });
  const existingDebtIsActive = isActiveDebtState({
    status: existingDebt.status,
    archivedAt: existingDebt.archivedAt,
  });
  const nextDebtWillBeActive = isActiveDebtState({
    status,
    archivedAt,
  });

  await assertDebtLimit({
    userId,
    nextDebtWillBeActive,
    activeDebtCountDelta: existingDebtIsActive ? -1 : 0,
  });

  const updateResult = await prisma.debt.updateMany({
    where: { id: debtId, userId },
    data: {
      name: input.name,
      creditorName: input.creditorName,
      type: input.type,
      status,
      currency: input.currency,
      currentBalance,
      creditLimit: input.creditLimit ?? null,
      interestRate: input.interestRate,
      interestRateType: input.interestRateType,
      minimumPayment: input.minimumPayment,
      statementDay: input.statementDay ?? null,
      dueDay: input.dueDay ?? null,
      nextDueDate: input.nextDueDate ?? null,
      notificationsEnabled: input.notificationsEnabled,
      lateFeeAmount,
      extraChargesAmount,
      notes: encryptSensitiveText(input.notes),
      startedAt: input.startedAt ?? null,
      estimatedEndAt: input.estimatedEndAt ?? null,
      archivedAt,
      paidOffAt:
        status === DebtStatus.PAID ? existingDebt.paidOffAt ?? new Date() : null,
    },
  });

  if (updateResult.count !== 1) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  const debt = await getUserDebtRecord(userId, debtId);

  await createAuditLog({
    userId,
    debtId: debt.id,
    action: status === DebtStatus.ARCHIVED ? AuditAction.DEBT_ARCHIVED : AuditAction.DEBT_UPDATED,
    resourceType: "debt",
    resourceId: debt.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  await captureBalanceSnapshot(userId, BalanceSnapshotSource.MUTATION);

  return mapDebtToDto(debt);
}

export async function deleteDebt(
  userId: string,
  debtId: string,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (isDemoSessionUser({ id: userId })) {
    await deleteDemoPaymentsForDebt(debtId);
    await deleteDemoDebt(debtId);
    return;
  }

  await getUserDebtRecord(userId, debtId);

  const deleteResult = await prisma.debt.deleteMany({
    where: { id: debtId, userId },
  });

  if (deleteResult.count !== 1) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  await createAuditLog({
    userId,
    debtId,
    action: AuditAction.DEBT_DELETED,
    resourceType: "debt",
    resourceId: debtId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  await captureBalanceSnapshot(userId, BalanceSnapshotSource.MUTATION);
}

export async function getDebtById(userId: string, debtId: string): Promise<DebtItemDto> {
  if (isDemoSessionUser({ id: userId })) {
    return getDemoDebtById(debtId);
  }

  const debt = await getUserDebtRecord(userId, debtId);
  return mapDebtToDto(debt);
}
