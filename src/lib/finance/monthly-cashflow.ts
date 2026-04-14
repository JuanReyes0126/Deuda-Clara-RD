type NullableMoney = number | null | undefined;

export type MonthlyCashflowInput = {
  monthlyIncome: NullableMoney;
  monthlyHousingCost: NullableMoney;
  monthlyGroceriesCost: NullableMoney;
  monthlyUtilitiesCost: NullableMoney;
  monthlyTransportCost: NullableMoney;
  monthlyOtherEssentialExpenses: NullableMoney;
};

export type MonthlyCashflowSnapshot = {
  monthlyIncome: number | null;
  monthlyHousingCost: number | null;
  monthlyGroceriesCost: number | null;
  monthlyUtilitiesCost: number | null;
  monthlyTransportCost: number | null;
  monthlyOtherEssentialExpenses: number | null;
  monthlyEssentialExpensesTotal: number | null;
  monthlyDebtCapacity: number | null;
};

function normalizeMoney(value: NullableMoney) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Number(value));
}

export function buildMonthlyCashflowSnapshot(
  input: MonthlyCashflowInput,
): MonthlyCashflowSnapshot {
  const monthlyIncome = normalizeMoney(input.monthlyIncome);
  const monthlyHousingCost = normalizeMoney(input.monthlyHousingCost);
  const monthlyGroceriesCost = normalizeMoney(input.monthlyGroceriesCost);
  const monthlyUtilitiesCost = normalizeMoney(input.monthlyUtilitiesCost);
  const monthlyTransportCost = normalizeMoney(input.monthlyTransportCost);
  const monthlyOtherEssentialExpenses = normalizeMoney(
    input.monthlyOtherEssentialExpenses,
  );
  const hasExpenseProfile = [
    monthlyHousingCost,
    monthlyGroceriesCost,
    monthlyUtilitiesCost,
    monthlyTransportCost,
    monthlyOtherEssentialExpenses,
  ].some((value) => value !== null);

  const monthlyEssentialExpensesTotal =
    monthlyIncome !== null || hasExpenseProfile
      ? [
          monthlyHousingCost,
          monthlyGroceriesCost,
          monthlyUtilitiesCost,
          monthlyTransportCost,
          monthlyOtherEssentialExpenses,
        ].reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;

  return {
    monthlyIncome,
    monthlyHousingCost,
    monthlyGroceriesCost,
    monthlyUtilitiesCost,
    monthlyTransportCost,
    monthlyOtherEssentialExpenses,
    monthlyEssentialExpensesTotal,
    monthlyDebtCapacity:
      monthlyIncome !== null && monthlyEssentialExpensesTotal !== null
        ? Math.max(0, monthlyIncome - monthlyEssentialExpensesTotal)
        : null,
  };
}
