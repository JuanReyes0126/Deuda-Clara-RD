import { DebtStatus } from "@prisma/client";
import { cookies } from "next/headers";

import { demoDebts } from "@/lib/demo/data";
import type { DebtItemDto, DebtSummaryDto } from "@/lib/types/app";
import type { DebtInput } from "@/lib/validations/debts";
import { decimal, toMoneyNumber } from "@/lib/utils/decimal";
import { deriveDebtStatus, getDebtMonthlyRate } from "@/server/finance/debt-helpers";
import { ServiceError } from "@/server/services/service-error";

const DEMO_DEBTS_COOKIE_NAME = "dc_demo_debts";

function cloneDebts(debts: DebtItemDto[]) {
  return JSON.parse(JSON.stringify(debts)) as DebtItemDto[];
}

function encodeDebts(debts: DebtItemDto[]) {
  return Buffer.from(JSON.stringify(debts), "utf8").toString("base64url");
}

function decodeDebts(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

    if (!Array.isArray(parsed)) {
      return null;
    }

    return (parsed as DebtItemDto[]).map((debt) => ({
      ...debt,
      notificationsEnabled: debt.notificationsEnabled ?? true,
    }));
  } catch {
    return null;
  }
}

function sortDebts(debts: DebtItemDto[]) {
  return debts.slice().sort((left, right) => {
    const archivedLeft = left.archivedAt ? 1 : 0;
    const archivedRight = right.archivedAt ? 1 : 0;

    if (archivedLeft !== archivedRight) {
      return archivedLeft - archivedRight;
    }

    const dueLeft = left.nextDueDate ? new Date(left.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const dueRight = right.nextDueDate ? new Date(right.nextDueDate).getTime() : Number.MAX_SAFE_INTEGER;

    if (dueLeft !== dueRight) {
      return dueLeft - dueRight;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function buildDebtSummary(debts: DebtItemDto[]): DebtSummaryDto {
  return debts.reduce(
    (summary, debt) => {
      const isArchived = Boolean(debt.archivedAt) || debt.status === "ARCHIVED";

      return {
        activeDebtCount: isArchived ? summary.activeDebtCount : summary.activeDebtCount + 1,
        archivedDebtCount: isArchived ? summary.archivedDebtCount + 1 : summary.archivedDebtCount,
        totalBalance: toMoneyNumber(decimal(summary.totalBalance).plus(debt.effectiveBalance)),
        totalMinimumPayment: toMoneyNumber(decimal(summary.totalMinimumPayment).plus(debt.minimumPayment)),
        totalMonthlyInterest: toMoneyNumber(
          decimal(summary.totalMonthlyInterest).plus(debt.monthlyInterestEstimate),
        ),
        overdueCount: debt.status === "LATE" ? summary.overdueCount + 1 : summary.overdueCount,
      };
    },
    {
      activeDebtCount: 0,
      archivedDebtCount: 0,
      totalBalance: 0,
      totalMinimumPayment: 0,
      totalMonthlyInterest: 0,
      overdueCount: 0,
    } satisfies DebtSummaryDto,
  );
}

function buildDebtDto(input: DebtInput, existing?: DebtItemDto): DebtItemDto {
  const currentBalance = decimal(input.currentBalance);
  const lateFeeAmount = decimal(input.lateFeeAmount);
  const extraChargesAmount = decimal(input.extraChargesAmount);
  const archivedAt =
    input.status === DebtStatus.ARCHIVED
      ? existing?.archivedAt ?? new Date().toISOString()
      : null;
  const derivedStatus = deriveDebtStatus({
    currentBalance,
    lateFeeAmount,
    extraChargesAmount,
    archivedAt: archivedAt ? new Date(archivedAt) : null,
    preferredStatus: input.status,
    nextDueDate: input.nextDueDate,
  });
  const effectiveBalance = toMoneyNumber(currentBalance.plus(lateFeeAmount).plus(extraChargesAmount));
  const monthlyInterestEstimate = toMoneyNumber(
    currentBalance.mul(getDebtMonthlyRate(input.interestRate, input.interestRateType)),
  );
  const utilizationPct =
    input.type === "CREDIT_CARD" && input.creditLimit && input.creditLimit > 0
      ? Number(((input.currentBalance / input.creditLimit) * 100).toFixed(1))
      : null;
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? `demo-debt-${Date.now()}`,
    name: input.name,
    creditorName: input.creditorName,
    type: input.type,
    status: derivedStatus,
    currency: input.currency,
    currentBalance: toMoneyNumber(currentBalance),
    creditLimit: input.creditLimit ?? null,
    effectiveBalance,
    interestRate: toMoneyNumber(input.interestRate),
    interestRateType: input.interestRateType,
    monthlyInterestEstimate,
    minimumPayment: toMoneyNumber(input.minimumPayment),
    statementDay: input.statementDay ?? null,
    dueDay: input.dueDay ?? null,
    nextDueDate: input.nextDueDate?.toISOString() ?? null,
    notificationsEnabled: input.notificationsEnabled,
    lateFeeAmount: toMoneyNumber(lateFeeAmount),
    extraChargesAmount: toMoneyNumber(extraChargesAmount),
    utilizationPct,
    notes: input.notes ?? null,
    startedAt: input.startedAt?.toISOString() ?? null,
    estimatedEndAt: input.estimatedEndAt?.toISOString() ?? null,
    paidOffAt:
      derivedStatus === DebtStatus.PAID ? existing?.paidOffAt ?? now : null,
    archivedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    paymentCount: existing?.paymentCount ?? 0,
    totalPaid: existing?.totalPaid ?? 0,
    lastPaymentAt: existing?.lastPaymentAt ?? null,
    lastPaymentAmount: existing?.lastPaymentAmount ?? null,
  };
}

async function getDemoDebtState() {
  const store = await cookies();
  const storedDebts = decodeDebts(store.get(DEMO_DEBTS_COOKIE_NAME)?.value);
  return storedDebts ? sortDebts(storedDebts) : sortDebts(cloneDebts(demoDebts));
}

async function setDemoDebtState(debts: DebtItemDto[]) {
  const store = await cookies();
  store.set(DEMO_DEBTS_COOKIE_NAME, encodeDebts(sortDebts(debts)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    priority: "high",
  });
}

export async function saveDemoDebts(debts: DebtItemDto[]) {
  await setDemoDebtState(debts);
}

export async function listDemoDebts(includeArchived = true) {
  const debts = await getDemoDebtState();
  return includeArchived ? debts : debts.filter((debt) => !debt.archivedAt);
}

export async function getDemoDebtSummary() {
  const debts = await getDemoDebtState();
  return buildDebtSummary(debts);
}

export async function getDemoDebtById(debtId: string) {
  const debts = await getDemoDebtState();
  const debt = debts.find((item) => item.id === debtId);

  if (!debt) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  return debt;
}

export async function createDemoDebt(input: DebtInput) {
  const debts = await getDemoDebtState();
  const debt = buildDebtDto(input);
  await setDemoDebtState([debt, ...debts]);
  return debt;
}

export async function updateDemoDebt(debtId: string, input: DebtInput) {
  const debts = await getDemoDebtState();
  const existingDebt = debts.find((item) => item.id === debtId);

  if (!existingDebt) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  const updatedDebt = buildDebtDto(input, existingDebt);
  await setDemoDebtState(
    debts.map((debt) => (debt.id === debtId ? updatedDebt : debt)),
  );
  return updatedDebt;
}

export async function deleteDemoDebt(debtId: string) {
  const debts = await getDemoDebtState();
  const existingDebt = debts.find((item) => item.id === debtId);

  if (!existingDebt) {
    throw new ServiceError("DEBT_NOT_FOUND", 404, "No se encontró la deuda.");
  }

  await setDemoDebtState(debts.filter((debt) => debt.id !== debtId));
}
