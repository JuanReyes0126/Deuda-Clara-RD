import { PaymentManager } from "@/features/payments/components/payment-manager";
import { requireUser } from "@/lib/auth/session";
import { listUserDebts } from "@/server/debts/debt-service";
import { listUserPayments } from "@/server/payments/payment-service";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const entryFlow =
    resolvedSearchParams.from === "onboarding" ? "onboarding" : null;
  const defaultDebtId =
    typeof resolvedSearchParams.debtId === "string"
      ? resolvedSearchParams.debtId
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
    />
  );
}
