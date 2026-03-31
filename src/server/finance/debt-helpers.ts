import type {
  Debt,
  InterestRateType,
  Payment,
  Prisma,
} from "@prisma/client";
import { DebtStatus } from "@prisma/client";
import Decimal from "decimal.js";

import type { DebtItemDto, PaymentItemDto } from "@/lib/types/app";
import { decryptSensitiveText } from "@/lib/security/encryption";
import {
  decimal,
  toMoneyNumber,
} from "@/lib/utils/decimal";
import type { StrategyDebtInput } from "@/server/planner/strategy-engine";

type DebtWithPayments = Debt & {
  payments: Payment[];
};

export function getDebtMonthlyRate(
  interestRate: Prisma.Decimal | number | string,
  interestRateType: InterestRateType,
) {
  const normalizedRate = decimal(interestRate).div(100);

  return interestRateType === "MONTHLY"
    ? normalizedRate
    : normalizedRate.div(12);
}

export function getEffectiveDebtBalance(debt: Pick<Debt, "currentBalance" | "lateFeeAmount" | "extraChargesAmount">) {
  return decimal(debt.currentBalance)
    .plus(debt.lateFeeAmount)
    .plus(debt.extraChargesAmount);
}

export function deriveDebtStatus(input: {
  currentBalance: Decimal;
  lateFeeAmount: Decimal;
  extraChargesAmount: Decimal;
  archivedAt?: Date | null | undefined;
  preferredStatus?: DebtStatus | undefined;
  nextDueDate?: Date | null | undefined;
}) {
  if (input.archivedAt) {
    return DebtStatus.ARCHIVED;
  }

  const effectiveBalance = input.currentBalance
    .plus(input.lateFeeAmount)
    .plus(input.extraChargesAmount);

  if (effectiveBalance.lessThanOrEqualTo(0)) {
    return DebtStatus.PAID;
  }

  if (input.preferredStatus === DebtStatus.NEGOTIATING) {
    return DebtStatus.NEGOTIATING;
  }

  if (input.nextDueDate && input.nextDueDate.getTime() < Date.now()) {
    return DebtStatus.LATE;
  }

  return DebtStatus.CURRENT;
}

export function mapDebtToDto(debt: DebtWithPayments): DebtItemDto {
  const effectiveBalance = getEffectiveDebtBalance(debt);
  const monthlyInterestEstimate = decimal(debt.currentBalance)
    .mul(getDebtMonthlyRate(debt.interestRate, debt.interestRateType));
  const latestPayment = debt.payments
    .slice()
    .sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime())[0];
  const totalPaid = debt.payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));
  const utilizationPct =
    debt.creditLimit && decimal(debt.creditLimit).greaterThan(0)
      ? decimal(debt.currentBalance)
          .div(debt.creditLimit)
          .mul(100)
          .toDecimalPlaces(1, Decimal.ROUND_HALF_UP)
          .toNumber()
      : null;

  return {
    id: debt.id,
    name: debt.name,
    creditorName: debt.creditorName,
    type: debt.type,
    status: debt.status,
    currency: debt.currency,
    currentBalance: toMoneyNumber(debt.currentBalance),
    creditLimit: debt.creditLimit ? toMoneyNumber(debt.creditLimit) : null,
    effectiveBalance: toMoneyNumber(effectiveBalance),
    interestRate: decimal(debt.interestRate).toNumber(),
    interestRateType: debt.interestRateType,
    monthlyInterestEstimate: toMoneyNumber(monthlyInterestEstimate),
    minimumPayment: toMoneyNumber(debt.minimumPayment),
    statementDay: debt.statementDay,
    dueDay: debt.dueDay,
    nextDueDate: debt.nextDueDate?.toISOString() ?? null,
    lateFeeAmount: toMoneyNumber(debt.lateFeeAmount),
    extraChargesAmount: toMoneyNumber(debt.extraChargesAmount),
    utilizationPct,
    notes: decryptSensitiveText(debt.notes),
    startedAt: debt.startedAt?.toISOString() ?? null,
    estimatedEndAt: debt.estimatedEndAt?.toISOString() ?? null,
    paidOffAt: debt.paidOffAt?.toISOString() ?? null,
    archivedAt: debt.archivedAt?.toISOString() ?? null,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
    paymentCount: debt.payments.length,
    totalPaid: toMoneyNumber(totalPaid),
    lastPaymentAt: latestPayment?.paidAt.toISOString() ?? null,
    lastPaymentAmount: latestPayment ? toMoneyNumber(latestPayment.amount) : null,
  };
}

export function mapPaymentToDto(
  payment: Payment & { debt: Pick<Debt, "name"> },
): PaymentItemDto {
  return {
    id: payment.id,
    debtId: payment.debtId,
    debtName: payment.debt.name,
    amount: toMoneyNumber(payment.amount),
    principalAmount: payment.principalAmount ? toMoneyNumber(payment.principalAmount) : null,
    interestAmount: payment.interestAmount ? toMoneyNumber(payment.interestAmount) : null,
    lateFeeAmount: payment.lateFeeAmount ? toMoneyNumber(payment.lateFeeAmount) : null,
    extraChargesAmount: payment.extraChargesAmount ? toMoneyNumber(payment.extraChargesAmount) : null,
    remainingBalanceAfter: payment.remainingBalanceAfter
      ? toMoneyNumber(payment.remainingBalanceAfter)
      : null,
    source: payment.source,
    notes: decryptSensitiveText(payment.notes),
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

type StrategyDebtSource = {
  id: string;
  name: string;
  type: Debt["type"] | DebtItemDto["type"];
  status: Debt["status"] | DebtItemDto["status"];
  currentBalance: Debt["currentBalance"] | DebtItemDto["currentBalance"];
  interestRate: Debt["interestRate"] | DebtItemDto["interestRate"];
  interestRateType: Debt["interestRateType"] | DebtItemDto["interestRateType"];
  minimumPayment: Debt["minimumPayment"] | DebtItemDto["minimumPayment"];
  lateFeeAmount?: Debt["lateFeeAmount"] | DebtItemDto["lateFeeAmount"] | null;
  extraChargesAmount?: Debt["extraChargesAmount"] | DebtItemDto["extraChargesAmount"] | null;
  nextDueDate?: Debt["nextDueDate"] | DebtItemDto["nextDueDate"] | null;
  [key: string]: unknown;
};

export function buildStrategyDebtInput(debt: StrategyDebtSource): StrategyDebtInput {
  return {
    id: debt.id,
    name: debt.name,
    type: debt.type as Debt["type"],
    status: debt.status as Debt["status"],
    currentBalance: debt.currentBalance,
    interestRate: debt.interestRate,
    interestRateType: debt.interestRateType as InterestRateType,
    minimumPayment: debt.minimumPayment,
    ...(debt.lateFeeAmount !== undefined ? { lateFeeAmount: debt.lateFeeAmount } : {}),
    ...(debt.extraChargesAmount !== undefined
      ? { extraChargesAmount: debt.extraChargesAmount }
      : {}),
    ...(debt.nextDueDate !== undefined ? { nextDueDate: debt.nextDueDate } : {}),
  };
}

export function isMinimumPaymentRisk(debt: StrategyDebtSource) {
  const estimatedMonthlyInterest = decimal(debt.currentBalance).mul(
    getDebtMonthlyRate(debt.interestRate, debt.interestRateType as InterestRateType),
  );

  return debt.type === "CREDIT_CARD" && decimal(debt.minimumPayment).lessThanOrEqualTo(estimatedMonthlyInterest.mul(1.1));
}
