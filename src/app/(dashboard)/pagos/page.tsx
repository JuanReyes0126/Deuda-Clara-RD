import { PaymentManager } from "@/features/payments/components/payment-manager";
import { listUserDebts } from "@/server/debts/debt-service";
import { listUserPayments } from "@/server/payments/payment-service";
import { getRequestSessionUser } from "@/server/request/request-user-context";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getRequestSessionUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const entryFlow =
    resolvedSearchParams.from === "onboarding" ? "onboarding" : null;
  const defaultDebtId =
    typeof resolvedSearchParams.debtId === "string"
      ? resolvedSearchParams.debtId
      : undefined;
  const rawDefaultAmount =
    typeof resolvedSearchParams.amount === "string"
      ? Number(resolvedSearchParams.amount)
      : undefined;
  const defaultAmount =
    rawDefaultAmount && Number.isFinite(rawDefaultAmount) && rawDefaultAmount > 0
      ? rawDefaultAmount
      : undefined;

  const [debts, payments] = await Promise.all([
    listUserDebts(user.id, false),
    listUserPayments(user.id),
  ]);

  return (
    <PaymentManager
      debts={debts}
      payments={payments}
      entryFlow={entryFlow}
      {...(defaultDebtId ? { defaultDebtId } : {})}
      {...(defaultAmount ? { defaultAmount } : {})}
    />
  );
}
