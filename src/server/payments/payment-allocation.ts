import {
  DebtStatus,
  type InterestRateType,
} from "@prisma/client";
import Decimal from "decimal.js";

import type { PaymentInput } from "@/lib/validations/payments";
import { decimal } from "@/lib/utils/decimal";
import {
  deriveDebtStatus,
  getDebtMonthlyRate,
} from "@/server/finance/debt-helpers";
import { ServiceError } from "@/server/services/service-error";

export type AllocatableDebtState = {
  currentBalance: Decimal.Value;
  lateFeeAmount: Decimal.Value;
  extraChargesAmount: Decimal.Value;
  interestRate: Decimal | number | string;
  interestRateType: InterestRateType | string;
  status?: DebtStatus | string;
  nextDueDate?: Date | string | null;
  archivedAt?: Date | string | null;
  paidOffAt?: Date | string | null;
};

export type MutableDebtState = {
  currentBalance: Decimal;
  lateFeeAmount: Decimal;
  extraChargesAmount: Decimal;
};

export type PaymentAllocationState = {
  principalAmount: Decimal;
  interestAmount: Decimal;
  lateFeeAmount: Decimal;
  extraChargesAmount: Decimal;
  remainingBalanceAfter: Decimal;
  debtState: MutableDebtState;
};

type AllocatablePaymentState = {
  principalAmount?: Decimal.Value | null;
  interestAmount?: Decimal.Value | null;
  lateFeeAmount?: Decimal.Value | null;
  extraChargesAmount?: Decimal.Value | null;
};

export function applyPaymentAllocation(
  debt: AllocatableDebtState,
  input: PaymentInput,
): PaymentAllocationState {
  const state: MutableDebtState = {
    currentBalance: decimal(debt.currentBalance),
    lateFeeAmount: decimal(debt.lateFeeAmount),
    extraChargesAmount: decimal(debt.extraChargesAmount),
  };
  const amount = decimal(input.amount);
  const totalDue = state.currentBalance
    .plus(state.lateFeeAmount)
    .plus(state.extraChargesAmount);

  if (amount.lessThanOrEqualTo(0)) {
    throw new ServiceError("PAYMENT_INVALID", 400, "El pago debe ser mayor que cero.");
  }

  if (amount.greaterThan(totalDue.plus(0.01))) {
    throw new ServiceError(
      "PAYMENT_EXCEEDS_BALANCE",
      400,
      "El pago no puede exceder la deuda pendiente.",
    );
  }

  let remaining = amount;
  const explicitLateFees = input.lateFeeAmount !== undefined;
  const explicitExtraCharges = input.extraChargesAmount !== undefined;
  const lateFeeAmount = explicitLateFees
    ? Decimal.min(decimal(input.lateFeeAmount), state.lateFeeAmount, remaining)
    : Decimal.min(state.lateFeeAmount, remaining);
  remaining = remaining.minus(lateFeeAmount);
  state.lateFeeAmount = state.lateFeeAmount.minus(lateFeeAmount);

  const extraChargesAmount = explicitExtraCharges
    ? Decimal.min(decimal(input.extraChargesAmount), state.extraChargesAmount, remaining)
    : Decimal.min(state.extraChargesAmount, remaining);
  remaining = remaining.minus(extraChargesAmount);
  state.extraChargesAmount = state.extraChargesAmount.minus(extraChargesAmount);

  const estimatedInterest = Decimal.min(
    state.currentBalance,
    state.currentBalance.mul(
      getDebtMonthlyRate(
        debt.interestRate,
        debt.interestRateType as InterestRateType,
      ),
    ),
  );
  const interestAmount =
    input.interestAmount !== undefined
      ? Decimal.min(decimal(input.interestAmount), state.currentBalance, remaining)
      : Decimal.min(estimatedInterest, remaining);
  remaining = remaining.minus(interestAmount);

  let principalAmount =
    input.principalAmount !== undefined
      ? Decimal.min(
          decimal(input.principalAmount),
          state.currentBalance.minus(interestAmount),
          remaining,
        )
      : Decimal.min(state.currentBalance.minus(interestAmount), remaining);
  remaining = remaining.minus(principalAmount);

  if (remaining.greaterThan(0)) {
    const additionalPrincipal = Decimal.min(
      state.currentBalance.minus(interestAmount).minus(principalAmount),
      remaining,
    );

    principalAmount = principalAmount.plus(additionalPrincipal);
    remaining = remaining.minus(additionalPrincipal);
  }

  if (remaining.greaterThan(0.01)) {
    throw new ServiceError(
      "PAYMENT_ALLOCATION_INVALID",
      400,
      "No se pudo distribuir el pago sin generar saldos negativos.",
    );
  }

  state.currentBalance = state.currentBalance
    .minus(principalAmount)
    .minus(interestAmount);

  return {
    principalAmount,
    interestAmount,
    lateFeeAmount,
    extraChargesAmount,
    remainingBalanceAfter: state.currentBalance
      .plus(state.lateFeeAmount)
      .plus(state.extraChargesAmount)
      .toDecimalPlaces(2),
    debtState: {
      currentBalance: Decimal.max(state.currentBalance, 0).toDecimalPlaces(2),
      lateFeeAmount: Decimal.max(state.lateFeeAmount, 0).toDecimalPlaces(2),
      extraChargesAmount: Decimal.max(state.extraChargesAmount, 0).toDecimalPlaces(2),
    },
  };
}

export function revertPaymentFromDebtState(
  debt: Pick<AllocatableDebtState, "currentBalance" | "lateFeeAmount" | "extraChargesAmount">,
  payment: AllocatablePaymentState,
): MutableDebtState {
  return {
    currentBalance: decimal(debt.currentBalance)
      .plus(payment.principalAmount ?? 0)
      .plus(payment.interestAmount ?? 0),
    lateFeeAmount: decimal(debt.lateFeeAmount).plus(payment.lateFeeAmount ?? 0),
    extraChargesAmount: decimal(debt.extraChargesAmount).plus(payment.extraChargesAmount ?? 0),
  };
}

export function derivePaymentDebtStatus(
  debt: Pick<AllocatableDebtState, "status" | "nextDueDate" | "archivedAt">,
  nextState: MutableDebtState,
) {
  return deriveDebtStatus({
    currentBalance: nextState.currentBalance,
    lateFeeAmount: nextState.lateFeeAmount,
    extraChargesAmount: nextState.extraChargesAmount,
    preferredStatus:
      debt.status === DebtStatus.NEGOTIATING ? DebtStatus.NEGOTIATING : undefined,
    nextDueDate: debt.nextDueDate ? new Date(debt.nextDueDate) : null,
    archivedAt: debt.archivedAt ? new Date(debt.archivedAt) : null,
  });
}
