import { addMonths, addWeeks } from "date-fns";
import Decimal from "decimal.js";

export type DebtSimulatorDebtType =
  | "CREDIT_CARD"
  | "PERSONAL_LOAN"
  | "FIXED_NO_INTEREST";

export type DebtSimulatorRateType = "ANNUAL" | "MONTHLY";
export type DebtSimulatorFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY";
export type DebtSimulatorScenarioId = "BASE" | "EXTRA" | "AGGRESSIVE";

export type DebtSimulatorInput = {
  debtType: DebtSimulatorDebtType;
  principal: number;
  interestRate: number;
  interestRateType: DebtSimulatorRateType;
  paymentAmount: number;
  extraPayment?: number;
  startDate: Date;
  paymentFrequency: DebtSimulatorFrequency;
};

export type DebtSimulatorScheduleItem = {
  period: number;
  date: string;
  payment: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
};

export type DebtSimulatorScenario = {
  id: DebtSimulatorScenarioId;
  label: string;
  paymentAmount: number;
  monthsToPayoff: number | null;
  totalPaid: number;
  totalInterest: number;
  payoffDate: string | null;
  feasible: boolean;
  warnings: string[];
  amortizationSchedule: DebtSimulatorScheduleItem[];
};

export type DebtSimulationResult = {
  monthsToPayoff: number | null;
  totalPaid: number;
  totalInterest: number;
  amortizationSchedule: DebtSimulatorScheduleItem[];
  savingsWithExtraPayment: {
    interestSaved: number;
    monthsSaved: number | null;
    totalPaidSaved: number;
  };
  warnings: string[];
  scenarios: {
    base: DebtSimulatorScenario;
    extra: DebtSimulatorScenario;
    aggressive: DebtSimulatorScenario | null;
  };
};

const periodsPerYearMap: Record<DebtSimulatorFrequency, number> = {
  MONTHLY: 12,
  BIWEEKLY: 26,
  WEEKLY: 52,
};

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function numberMoney(value: Decimal.Value) {
  return money(value).toNumber();
}

function monthValue(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
}

function getPeriodRate(input: DebtSimulatorInput) {
  if (input.debtType === "FIXED_NO_INTEREST" || input.interestRate === 0) {
    return new Decimal(0);
  }

  const periodsPerYear = periodsPerYearMap[input.paymentFrequency];
  const rate = new Decimal(input.interestRate).div(100);

  if (input.interestRateType === "ANNUAL") {
    return rate.plus(1).pow(new Decimal(1).div(periodsPerYear)).minus(1);
  }

  return rate.plus(1).pow(new Decimal(12).div(periodsPerYear)).minus(1);
}

function addFrequency(date: Date, frequency: DebtSimulatorFrequency) {
  if (frequency === "MONTHLY") {
    return addMonths(date, 1);
  }

  return addWeeks(date, frequency === "BIWEEKLY" ? 2 : 1);
}

function buildScenarioPayment(
  input: DebtSimulatorInput,
  scenarioId: DebtSimulatorScenarioId,
) {
  const basePayment = new Decimal(input.paymentAmount);
  const extraPayment = new Decimal(input.extraPayment ?? 0);

  if (scenarioId === "BASE") {
    return basePayment;
  }

  if (scenarioId === "EXTRA") {
    return basePayment.plus(extraPayment);
  }

  const aggressiveBoost = Decimal.max(extraPayment.mul(2), basePayment.mul(0.5));
  return basePayment.plus(aggressiveBoost);
}

function simulateScenario(
  input: DebtSimulatorInput,
  scenarioId: DebtSimulatorScenarioId,
): DebtSimulatorScenario {
  const label =
    scenarioId === "BASE"
      ? "Pago normal"
      : scenarioId === "EXTRA"
        ? "Pago con extra"
        : "Pago agresivo";
  const warnings: string[] = [];
  const paymentPerPeriod = money(buildScenarioPayment(input, scenarioId));
  const periodRate = getPeriodRate(input);
  const periodsPerYear = periodsPerYearMap[input.paymentFrequency];
  const monthsPerPeriod = new Decimal(12).div(periodsPerYear);
  const maxPeriods = periodsPerYear * 50;

  let balance = money(input.principal);
  let totalPaid = new Decimal(0);
  let totalInterest = new Decimal(0);
  let currentDate = new Date(input.startDate);
  const amortizationSchedule: DebtSimulatorScheduleItem[] = [];

  if (balance.lte(0)) {
    warnings.push("El monto de la deuda debe ser mayor que cero.");

    return {
      id: scenarioId,
      label,
      paymentAmount: paymentPerPeriod.toNumber(),
      monthsToPayoff: null,
      totalPaid: 0,
      totalInterest: 0,
      payoffDate: null,
      feasible: false,
      warnings,
      amortizationSchedule,
    };
  }

  if (paymentPerPeriod.lte(0)) {
    warnings.push("Debes introducir un pago válido para poder proyectar la salida.");

    return {
      id: scenarioId,
      label,
      paymentAmount: paymentPerPeriod.toNumber(),
      monthsToPayoff: null,
      totalPaid: 0,
      totalInterest: 0,
      payoffDate: null,
      feasible: false,
      warnings,
      amortizationSchedule,
    };
  }

  const firstPeriodInterest = money(balance.mul(periodRate));

  if (periodRate.gt(0) && paymentPerPeriod.lte(firstPeriodInterest)) {
    warnings.push(
      "Con ese pago no cubres ni el interés generado. La deuda seguiría creciendo.",
    );

    return {
      id: scenarioId,
      label,
      paymentAmount: paymentPerPeriod.toNumber(),
      monthsToPayoff: null,
      totalPaid: 0,
      totalInterest: 0,
      payoffDate: null,
      feasible: false,
      warnings,
      amortizationSchedule,
    };
  }

  for (let period = 1; period <= maxPeriods; period += 1) {
    const interestPaid = money(balance.mul(periodRate));
    const amountDue = money(balance.plus(interestPaid));
    const actualPayment = Decimal.min(paymentPerPeriod, amountDue);
    const principalPaid = money(actualPayment.minus(interestPaid));

    if (actualPayment.lte(interestPaid) && balance.gt(0)) {
      warnings.push(
        "El pago de este escenario no alcanza para bajar capital de forma sostenible.",
      );

      return {
        id: scenarioId,
        label,
        paymentAmount: paymentPerPeriod.toNumber(),
        monthsToPayoff: null,
        totalPaid: numberMoney(totalPaid),
        totalInterest: numberMoney(totalInterest),
        payoffDate: null,
        feasible: false,
        warnings,
        amortizationSchedule,
      };
    }

    balance = money(amountDue.minus(actualPayment));
    totalPaid = totalPaid.plus(actualPayment);
    totalInterest = totalInterest.plus(interestPaid);

    amortizationSchedule.push({
      period,
      date: currentDate.toISOString(),
      payment: numberMoney(actualPayment),
      principalPaid: numberMoney(principalPaid),
      interestPaid: numberMoney(interestPaid),
      remainingBalance: numberMoney(balance),
    });

    if (balance.lte(0.01)) {
      const monthsToPayoff = monthValue(new Decimal(period).mul(monthsPerPeriod));

      return {
        id: scenarioId,
        label,
        paymentAmount: paymentPerPeriod.toNumber(),
        monthsToPayoff,
        totalPaid: numberMoney(totalPaid),
        totalInterest: numberMoney(totalInterest),
        payoffDate: currentDate.toISOString(),
        feasible: true,
        warnings,
        amortizationSchedule,
      };
    }

    currentDate = addFrequency(currentDate, input.paymentFrequency);
  }

  warnings.push(
    "Con estos datos la salida supera el horizonte de cálculo. Conviene subir el pago o revisar la tasa.",
  );

  return {
    id: scenarioId,
    label,
    paymentAmount: paymentPerPeriod.toNumber(),
    monthsToPayoff: null,
    totalPaid: numberMoney(totalPaid),
    totalInterest: numberMoney(totalInterest),
    payoffDate: null,
    feasible: false,
    warnings,
    amortizationSchedule,
  };
}

export function simulateDebt(input: DebtSimulatorInput): DebtSimulationResult {
  const normalizedInput: DebtSimulatorInput = {
    ...input,
    debtType: input.debtType,
    principal: numberMoney(input.principal),
    interestRate:
      input.debtType === "FIXED_NO_INTEREST" ? 0 : numberMoney(input.interestRate),
    paymentAmount: numberMoney(input.paymentAmount),
    extraPayment: numberMoney(input.extraPayment ?? 0),
    startDate: new Date(input.startDate),
  };

  const base = simulateScenario(normalizedInput, "BASE");
  const extra = simulateScenario(normalizedInput, "EXTRA");
  const aggressive =
    (normalizedInput.extraPayment ?? 0) > 0 || normalizedInput.paymentAmount > 0
      ? simulateScenario(normalizedInput, "AGGRESSIVE")
      : null;

  const interestSaved =
    base.feasible && extra.feasible
      ? numberMoney(new Decimal(base.totalInterest).minus(extra.totalInterest))
      : 0;
  const totalPaidSaved =
    base.feasible && extra.feasible
      ? numberMoney(new Decimal(base.totalPaid).minus(extra.totalPaid))
      : 0;
  const monthsSaved =
    base.monthsToPayoff !== null && extra.monthsToPayoff !== null
      ? monthValue(new Decimal(base.monthsToPayoff).minus(extra.monthsToPayoff))
      : null;

  return {
    monthsToPayoff: base.monthsToPayoff,
    totalPaid: base.totalPaid,
    totalInterest: base.totalInterest,
    amortizationSchedule: base.amortizationSchedule,
    savingsWithExtraPayment: {
      interestSaved,
      monthsSaved,
      totalPaidSaved,
    },
    warnings: [...new Set([...base.warnings, ...extra.warnings, ...(aggressive?.warnings ?? [])])],
    scenarios: {
      base,
      extra,
      aggressive,
    },
  };
}
