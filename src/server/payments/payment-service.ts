import { AuditAction, BalanceSnapshotSource, DebtStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  createDemoPayment,
  deleteDemoPayment,
  listDemoPayments,
  updateDemoPayment,
} from "@/lib/demo/payments";
import { isDemoModeEnabled, isDemoSessionUser } from "@/lib/demo/session";
import { encryptSensitiveText } from "@/lib/security/encryption";
import type { PaymentInput } from "@/lib/validations/payments";
import { decimal } from "@/lib/utils/decimal";
import { createAuditLog } from "@/server/audit/audit-service";
import {
  deriveDebtStatus,
  mapPaymentToDto,
} from "@/server/finance/debt-helpers";
import {
  applyPaymentAllocation,
  revertPaymentFromDebtState,
} from "@/server/payments/payment-allocation";
import { captureBalanceSnapshot } from "@/server/snapshots/balance-snapshot-service";
import {
  isDatabaseReachable,
  markDatabaseUnavailable,
} from "@/server/services/database-availability";
import { isInfrastructureUnavailableError } from "@/server/services/infrastructure-error";

import { ServiceError } from "../services/service-error";

async function shouldUseDemoPaymentFallback(userId: string) {
  if (isDemoSessionUser({ id: userId })) {
    return true;
  }

  if (!isDemoModeEnabled()) {
    return false;
  }

  return !(await isDatabaseReachable());
}

async function getUserDebt(userId: string, debtId: string) {
  const debt = await prisma.debt.findFirst({
    where: {
      id: debtId,
      userId,
    },
  });

  if (!debt) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  return debt;
}

async function getUserPayment(userId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      userId,
    },
    include: {
      debt: true,
    },
  });

  if (!payment) {
    throw new ServiceError("PAYMENT_NOT_FOUND", 404, "No se encontró el pago.");
  }

  return payment;
}

export async function listUserPayments(userId: string) {
  if (await shouldUseDemoPaymentFallback(userId)) {
    return listDemoPayments();
  }

  try {
    const payments = await prisma.payment.findMany({
      where: {
        userId,
      },
      include: {
        debt: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });

    return payments.map(mapPaymentToDto);
  } catch (error) {
    if (isInfrastructureUnavailableError(error) && isDemoModeEnabled()) {
      markDatabaseUnavailable();
      return listDemoPayments();
    }

    throw error;
  }
}

export async function createPayment(
  userId: string,
  input: PaymentInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (await shouldUseDemoPaymentFallback(userId)) {
    return createDemoPayment(input);
  }

  try {
    const debt = await getUserDebt(userId, input.debtId);
    const breakdown = applyPaymentAllocation(debt, input);

    const payment = await prisma.$transaction(async (transaction) => {
      const createdPayment = await transaction.payment.create({
        data: {
          userId,
          debtId: input.debtId,
          amount: decimal(input.amount).toDecimalPlaces(2),
          principalAmount: breakdown.principalAmount.toDecimalPlaces(2),
          interestAmount: breakdown.interestAmount.toDecimalPlaces(2),
          lateFeeAmount: breakdown.lateFeeAmount.toDecimalPlaces(2),
          extraChargesAmount: breakdown.extraChargesAmount.toDecimalPlaces(2),
          remainingBalanceAfter: breakdown.remainingBalanceAfter,
          source: input.source,
          notes: encryptSensitiveText(input.notes),
          paidAt: input.paidAt,
        },
        include: {
          debt: {
            select: {
              name: true,
            },
          },
        },
      });

      const debtUpdate = await transaction.debt.updateMany({
        where: { id: debt.id, userId },
        data: {
          currentBalance: breakdown.debtState.currentBalance,
          lateFeeAmount: breakdown.debtState.lateFeeAmount,
          extraChargesAmount: breakdown.debtState.extraChargesAmount,
          status: deriveDebtStatus({
            currentBalance: breakdown.debtState.currentBalance,
            lateFeeAmount: breakdown.debtState.lateFeeAmount,
            extraChargesAmount: breakdown.debtState.extraChargesAmount,
            preferredStatus:
              debt.status === DebtStatus.NEGOTIATING ? DebtStatus.NEGOTIATING : undefined,
            nextDueDate: debt.nextDueDate,
            archivedAt: debt.archivedAt,
          }),
          paidOffAt:
            breakdown.remainingBalanceAfter.lessThanOrEqualTo(0) ? new Date() : null,
        },
      });

      if (debtUpdate.count !== 1) {
        throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
      }

      return createdPayment;
    });

    await createAuditLog({
      userId,
      debtId: debt.id,
      paymentId: payment.id,
      action: AuditAction.PAYMENT_CREATED,
      resourceType: "payment",
      resourceId: payment.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await captureBalanceSnapshot(userId, BalanceSnapshotSource.MUTATION);

    return mapPaymentToDto(payment);
  } catch (error) {
    if (isInfrastructureUnavailableError(error) && isDemoModeEnabled()) {
      markDatabaseUnavailable();
      return createDemoPayment(input);
    }

    throw error;
  }
}

export async function updatePayment(
  userId: string,
  paymentId: string,
  input: PaymentInput,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (await shouldUseDemoPaymentFallback(userId)) {
    return updateDemoPayment(paymentId, input);
  }

  try {
    const existingPayment = await getUserPayment(userId, paymentId);

    if (existingPayment.debtId !== input.debtId) {
      throw new ServiceError(
        "PAYMENT_DEBT_CHANGE_NOT_SUPPORTED",
        400,
        "Por ahora debes eliminar el pago y volver a crearlo en otra deuda.",
      );
    }

    const currentDebt = await getUserDebt(userId, existingPayment.debtId);
    const revertedState = revertPaymentFromDebtState(currentDebt, existingPayment);
    const revertedDebt = {
      ...currentDebt,
      currentBalance: revertedState.currentBalance.toDecimalPlaces(2),
      lateFeeAmount: revertedState.lateFeeAmount.toDecimalPlaces(2),
      extraChargesAmount: revertedState.extraChargesAmount.toDecimalPlaces(2),
    };
    const breakdown = applyPaymentAllocation(revertedDebt, input);

    const payment = await prisma.$transaction(async (transaction) => {
      const debtUpdate = await transaction.debt.updateMany({
        where: { id: revertedDebt.id, userId },
        data: {
          currentBalance: breakdown.debtState.currentBalance,
          lateFeeAmount: breakdown.debtState.lateFeeAmount,
          extraChargesAmount: breakdown.debtState.extraChargesAmount,
          status: deriveDebtStatus({
            currentBalance: breakdown.debtState.currentBalance,
            lateFeeAmount: breakdown.debtState.lateFeeAmount,
            extraChargesAmount: breakdown.debtState.extraChargesAmount,
            preferredStatus:
              revertedDebt.status === DebtStatus.NEGOTIATING ? DebtStatus.NEGOTIATING : undefined,
            nextDueDate: revertedDebt.nextDueDate,
            archivedAt: revertedDebt.archivedAt,
          }),
          paidOffAt:
            breakdown.remainingBalanceAfter.lessThanOrEqualTo(0) ? new Date() : null,
        },
      });

      if (debtUpdate.count !== 1) {
        throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
      }

      const paymentUpdate = await transaction.payment.updateMany({
        where: { id: paymentId, userId },
        data: {
          amount: decimal(input.amount).toDecimalPlaces(2),
          principalAmount: breakdown.principalAmount.toDecimalPlaces(2),
          interestAmount: breakdown.interestAmount.toDecimalPlaces(2),
          lateFeeAmount: breakdown.lateFeeAmount.toDecimalPlaces(2),
          extraChargesAmount: breakdown.extraChargesAmount.toDecimalPlaces(2),
          remainingBalanceAfter: breakdown.remainingBalanceAfter,
          source: input.source,
          notes: encryptSensitiveText(input.notes),
          paidAt: input.paidAt,
        },
      });

      if (paymentUpdate.count !== 1) {
        throw new ServiceError("PAYMENT_NOT_FOUND", 404, "No se encontró el pago.");
      }

      return getUserPayment(userId, paymentId);
    });

    await createAuditLog({
      userId,
      debtId: payment.debtId,
      paymentId: payment.id,
      action: AuditAction.PAYMENT_UPDATED,
      resourceType: "payment",
      resourceId: payment.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await captureBalanceSnapshot(userId, BalanceSnapshotSource.MUTATION);

    return mapPaymentToDto(payment);
  } catch (error) {
    if (isInfrastructureUnavailableError(error) && isDemoModeEnabled()) {
      markDatabaseUnavailable();
      return updateDemoPayment(paymentId, input);
    }

    throw error;
  }
}

export async function deletePayment(
  userId: string,
  paymentId: string,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (await shouldUseDemoPaymentFallback(userId)) {
    await deleteDemoPayment(paymentId);
    return;
  }

  try {
    const existingPayment = await getUserPayment(userId, paymentId);
    const debt = await getUserDebt(userId, existingPayment.debtId);
    const revertedState = revertPaymentFromDebtState(debt, existingPayment);

    await prisma.$transaction(async (transaction) => {
      const status = deriveDebtStatus({
        currentBalance: revertedState.currentBalance,
        lateFeeAmount: revertedState.lateFeeAmount,
        extraChargesAmount: revertedState.extraChargesAmount,
        preferredStatus:
          debt.status === DebtStatus.NEGOTIATING ? DebtStatus.NEGOTIATING : undefined,
        nextDueDate: debt.nextDueDate,
        archivedAt: debt.archivedAt,
      });

      const debtUpdate = await transaction.debt.updateMany({
        where: { id: debt.id, userId },
        data: {
          currentBalance: revertedState.currentBalance.toDecimalPlaces(2),
          lateFeeAmount: revertedState.lateFeeAmount.toDecimalPlaces(2),
          extraChargesAmount: revertedState.extraChargesAmount.toDecimalPlaces(2),
          status,
          paidOffAt: status === DebtStatus.PAID ? debt.paidOffAt : null,
        },
      });
      if (debtUpdate.count !== 1) {
        throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
      }

      await transaction.auditLog.updateMany({
        where: { paymentId },
        data: { paymentId: null },
      });

      const paymentDelete = await transaction.payment.deleteMany({
        where: { id: paymentId, userId },
      });

      if (paymentDelete.count !== 1) {
        throw new ServiceError("PAYMENT_NOT_FOUND", 404, "No se encontró el pago.");
      }
      await createAuditLog(
        {
          userId,
          debtId: debt.id,
          action: AuditAction.PAYMENT_DELETED,
          resourceType: "payment",
          resourceId: paymentId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          metadata: {
            deletedFromDebtId: debt.id,
            deletedFromDebtName: debt.name,
          },
        },
        transaction,
      );
    });

    await captureBalanceSnapshot(userId, BalanceSnapshotSource.MUTATION);
  } catch (error) {
    if (isInfrastructureUnavailableError(error) && isDemoModeEnabled()) {
      markDatabaseUnavailable();
      await deleteDemoPayment(paymentId);
      return;
    }

    throw error;
  }
}
