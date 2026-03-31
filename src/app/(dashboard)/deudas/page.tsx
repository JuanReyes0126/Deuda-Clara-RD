import { DebtManager } from "@/features/debts/components/debt-manager";
import { requireUser } from "@/lib/auth/session";
import { isDemoSessionUser } from "@/lib/demo/session";
import { getDebtSummary, listUserDebts } from "@/server/debts/debt-service";

export default async function DebtsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const entryFlow = resolvedSearchParams.from === "onboarding" ? "onboarding" : null;

  if (isDemoSessionUser(user)) {
    const [debts, summary] = await Promise.all([
      listUserDebts(user.id),
      getDebtSummary(user.id),
    ]);

    return <DebtManager debts={debts} summary={summary} entryFlow={entryFlow} />;
  }

  const [debts, summary] = await Promise.all([
    listUserDebts(user.id),
    getDebtSummary(user.id),
  ]);

  return <DebtManager debts={debts} summary={summary} entryFlow={entryFlow} />;
}
