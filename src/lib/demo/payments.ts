import { DebtStatus } from "@prisma/client";
import { cookies } from "next/headers";

import { demoPayments } from "@/lib/demo/data";
import { demoDebts } from "@/lib/demo/data";
import { getDemoDebtById, listDemoDebts, saveDemoDebts } from "@/lib/demo/debts";
import type { DebtItemDto, PaymentItemDto } from "@/lib/types/app";
import type { PaymentInput } from "@/lib/validations/payments";
import { decimal, toMoneyNumber } from "@/lib/utils/decimal";
import { getDebtMonthlyRate } from "@/server/finance/debt-helpers";
import {
  applyPaymentAllocation,
  derivePaymentDebtStatus,
  revertPaymentFromDebtState,
  type MutableDebtState,
} from "@/server/payments/payment-allocation";
import { ServiceError } from "@/server/services/service-error";

const DEMO_PAYMENTS_COOKIE_NAME = "dc_demo_payments";

function clonePayments(payments: PaymentItemDto[]) {
  return JSON.parse(JSON.stringify(payments)) as PaymentItemDto[];
}

function encodePayments(payments: PaymentItemDto[]) {
  return Buffer.from(JSON.stringify(payments), "utf8").toString("base64url");
}

function decodePayments(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as PaymentItemDto[];
  } catch {
    return null;
  }
}

function sortPayments(payments: PaymentItemDto[]) {
  return payments.slice().sort((left, right) => {
    const paidLeft = new Date(left.paidAt).getTime();
    const paidRight = new Date(right.paidAt).getTime();

    if (paidLeft !== paidRight) {
      return paidRight - paidLeft;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

async function getDemoPaymentState() {
  const store = await cookies();
  const storedPayments = decodePayments(store.get(DEMO_PAYMENTS_COOKIE_NAME)?.value);
  return storedPayments ? sortPayments(storedPayments) : sortPayments(clonePayments(demoPayments));
}

async function setDemoPaymentState(payments: PaymentItemDto[]) {
  const store = await cookies();
  store.set(DEMO_PAYMENTS_COOKIE_NAME, encodePayments(sortPayments(payments)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    priority: "high",
  });
}

function getPaymentsForDebt(payments: PaymentItemDto[], debtId: string) {
  return sortPayments(payments.filter((payment) => payment.debtId === debtId));
}

function getSeedDebtBaseline(debtId: string) {
  const seedDebt = demoDebts.find((debt) => debt.id === debtId);

  if (!seedDebt) {
    return {
      hiddenPaymentCount: 0,
      hiddenTotalPaid: 0,
    };
  }

  const seededVisiblePayments = demoPayments.filter((payment) => payment.debtId === debtId);
  const seededVisibleTotal = seededVisiblePayments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    decimal(0),
  );

  return {
    hiddenPaymentCount: Math.max(seedDebt.paymentCount - seededVisiblePayments.length, 0),
    hiddenTotalPaid: toMoneyNumber(decimal(seedDebt.totalPaid).minus(seededVisibleTotal)),
  };
}

function buildUpdatedDebtRecord(
  debt: DebtItemDto,
  nextState: MutableDebtState,
  payments: PaymentItemDto[],
) {
  const currentBalance = toMoneyNumber(nextState.currentBalance);
  const lateFeeAmount = toMoneyNumber(nextState.lateFeeAmount);
  const extraChargesAmount = toMoneyNumber(nextState.extraChargesAmount);
  const effectiveBalance = toMoneyNumber(
    decimal(currentBalance).plus(lateFeeAmount).plus(extraChargesAmount),
  );
  const monthlyInterestEstimate = toMoneyNumber(
    decimal(currentBalance).mul(
      getDebtMonthlyRate(debt.interestRate, debt.interestRateType as never),
    ),
  );
  const latestPayment = payments[0] ?? null;
  const visiblePaid = payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    decimal(0),
  );
  const baseline = getSeedDebtBaseline(debt.id);
  const status = derivePaymentDebtStatus(debt, nextState);
  const now = new Date().toISOString();

  return {
    ...debt,
    status,
    currentBalance,
    lateFeeAmount,
    extraChargesAmount,
    effectiveBalance,
    monthlyInterestEstimate,
    paymentCount: baseline.hiddenPaymentCount + payments.length,
    totalPaid: toMoneyNumber(decimal(baseline.hiddenTotalPaid).plus(visiblePaid)),
    lastPaymentAt: latestPayment?.paidAt ?? null,
    lastPaymentAmount: latestPayment?.amount ?? null,
    paidOffAt:
      status === DebtStatus.PAID ? debt.paidOffAt ?? now : null,
    updatedAt: now,
  } satisfies DebtItemDto;
}

async function persistDemoPaymentMutation(
  debtId: string,
  nextState: MutableDebtState,
  payments: PaymentItemDto[],
) {
  const debts = await listDemoDebts(true);
  const debt = debts.find((item) => item.id === debtId);

  if (!debt) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  const paymentsForDebt = getPaymentsForDebt(payments, debtId);
  const updatedDebt = buildUpdatedDebtRecord(debt, nextState, paymentsForDebt);

  await Promise.all([
    saveDemoDebts(debts.map((item) => (item.id === debtId ? updatedDebt : item))),
    setDemoPaymentState(payments),
  ]);
}

function mapInputToDemoPayment(
  input: PaymentInput,
  debt: DebtItemDto,
  breakdown: ReturnType<typeof applyPaymentAllocation>,
  existing?: PaymentItemDto,
) {
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? `demo-payment-${Date.now()}`,
    debtId: debt.id,
    debtName: debt.name,
    amount: toMoneyNumber(input.amount),
    principalAmount: toMoneyNumber(breakdown.principalAmount),
    interestAmount: toMoneyNumber(breakdown.interestAmount),
    lateFeeAmount: toMoneyNumber(breakdown.lateFeeAmount),
    extraChargesAmount: toMoneyNumber(breakdown.extraChargesAmount),
    remainingBalanceAfter: toMoneyNumber(breakdown.remainingBalanceAfter),
    source: input.source,
    notes: input.notes ?? null,
    paidAt: input.paidAt.toISOString(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } satisfies PaymentItemDto;
}

export async function listDemoPayments() {
  return getDemoPaymentState();
}

export async function getDemoPaymentById(paymentId: string) {
  const payments = await getDemoPaymentState();
  const payment = payments.find((item) => item.id === paymentId);

  if (!payment) {
    throw new ServiceError("PAYMENT_NOT_FOUND", 404, "No se encontró el pago.");
  }

  return payment;
}

export async function createDemoPayment(input: PaymentInput) {
  const debt = await getDemoDebtById(input.debtId);
  const breakdown = applyPaymentAllocation(debt, input);
  const payment = mapInputToDemoPayment(input, debt, breakdown);
  const payments = await getDemoPaymentState();

  await persistDemoPaymentMutation(input.debtId, breakdown.debtState, [payment, ...payments]);

  return payment;
}

export async function updateDemoPayment(paymentId: string, input: PaymentInput) {
  const existingPayment = await getDemoPaymentById(paymentId);

  if (existingPayment.debtId !== input.debtId) {
    throw new ServiceError(
      "PAYMENT_DEBT_CHANGE_NOT_SUPPORTED",
      400,
      "Por ahora debes eliminar el pago y volver a crearlo en otra deuda.",
    );
  }

  const debt = await getDemoDebtById(existingPayment.debtId);
  const revertedState = revertPaymentFromDebtState(debt, existingPayment);
  const revertedDebt = {
    ...debt,
    currentBalance: toMoneyNumber(revertedState.currentBalance),
    lateFeeAmount: toMoneyNumber(revertedState.lateFeeAmount),
    extraChargesAmount: toMoneyNumber(revertedState.extraChargesAmount),
  };
  const breakdown = applyPaymentAllocation(revertedDebt, input);
  const updatedPayment = mapInputToDemoPayment(input, debt, breakdown, existingPayment);
  const payments = await getDemoPaymentState();

  await persistDemoPaymentMutation(
    debt.id,
    breakdown.debtState,
    payments.map((payment) => (payment.id === paymentId ? updatedPayment : payment)),
  );

  return updatedPayment;
}

export async function deleteDemoPayment(paymentId: string) {
  const existingPayment = await getDemoPaymentById(paymentId);
  const debt = await getDemoDebtById(existingPayment.debtId);
  const revertedState = revertPaymentFromDebtState(debt, existingPayment);
  const payments = await getDemoPaymentState();

  await persistDemoPaymentMutation(
    debt.id,
    revertedState,
    payments.filter((payment) => payment.id !== paymentId),
  );
}

export async function deleteDemoPaymentsForDebt(debtId: string) {
  const payments = await getDemoPaymentState();
  const filteredPayments = payments.filter((payment) => payment.debtId !== debtId);

  if (filteredPayments.length === payments.length) {
    return;
  }

  await setDemoPaymentState(filteredPayments);
}
