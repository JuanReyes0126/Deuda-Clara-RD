import { BalanceSnapshotSource } from "@prisma/client";
import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { decimal } from "@/lib/utils/decimal";
import { getDebtMonthlyRate } from "@/server/finance/debt-helpers";

type SnapshotClient =
  | typeof prisma
  | Pick<Prisma.TransactionClient, "debt" | "balanceSnapshot">;

export async function captureBalanceSnapshot(
  userId: string,
  source: BalanceSnapshotSource = BalanceSnapshotSource.MUTATION,
  client: SnapshotClient = prisma,
) {
  const debts = await client.debt.findMany({
    where: {
      userId,
      archivedAt: null,
      status: {
        notIn: ["PAID", "ARCHIVED"],
      },
    },
  });

  const totals = debts.reduce(
    (accumulator, debt) => ({
      totalBalance: accumulator.totalBalance
        .plus(debt.currentBalance)
        .plus(debt.lateFeeAmount)
        .plus(debt.extraChargesAmount),
      totalMinimumPayment: accumulator.totalMinimumPayment.plus(debt.minimumPayment),
      totalMonthlyInterestEstimate: accumulator.totalMonthlyInterestEstimate.plus(
        decimal(debt.currentBalance).mul(
          getDebtMonthlyRate(debt.interestRate, debt.interestRateType),
        ),
      ),
    }),
    {
      totalBalance: new Decimal(0),
      totalMinimumPayment: new Decimal(0),
      totalMonthlyInterestEstimate: new Decimal(0),
    },
  );

  return client.balanceSnapshot.create({
    data: {
      userId,
      source,
      totalBalance: totals.totalBalance.toDecimalPlaces(2),
      totalMinimumPayment: totals.totalMinimumPayment.toDecimalPlaces(2),
      totalMonthlyInterestEstimate: totals.totalMonthlyInterestEstimate.toDecimalPlaces(2),
    },
  });
}
