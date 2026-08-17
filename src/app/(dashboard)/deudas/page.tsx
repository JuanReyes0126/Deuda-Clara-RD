import { DebtManager } from "@/features/debts/components/debt-manager";
import { isDemoSessionUser } from "@/lib/demo/session";
import { getDebtSummary, listUserDebts } from "@/server/debts/debt-service";
import { getRequestMembershipContext, getRequestSessionUser } from "@/server/request/request-user-context";

export default async function DebtsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getRequestSessionUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const entryFlow = resolvedSearchParams.from === "onboarding" ? "onboarding" : null;

  if (isDemoSessionUser(user)) {
    const [debts, summary] = await Promise.all([
      listUserDebts(user.id),
      getDebtSummary(user.id),
    ]);

    return (
      <DebtManager
        debts={debts}
        summary={summary}
        entryFlow={entryFlow}
        membershipTier="NORMAL"
        billingStatus="ACTIVE"
      />
    );
  }

  const [debts, summary, membership] = await Promise.all([
    listUserDebts(user.id),
    getDebtSummary(user.id),
    getRequestMembershipContext(),
  ]);

  return (
    <DebtManager
      debts={debts}
      summary={summary}
      entryFlow={entryFlow}
      membershipTier={membership.membershipTier}
      billingStatus={membership.membershipBillingStatus}
    />
  );
}
