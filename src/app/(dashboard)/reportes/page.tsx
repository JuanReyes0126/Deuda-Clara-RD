import { ReportsPanel } from "@/features/reports/components/reports-panel";
import { reportSummary } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { getReportSummary } from "@/server/reports/report-service";
import { getRequestMembershipContext, getRequestSessionUser } from "@/server/request/request-user-context";

export default async function ReportsPage() {
  const user = await getRequestSessionUser();

  if (isDemoSessionUser(user)) {
    return (
      <ReportsPanel
        initialSummary={reportSummary}
        membershipTier="NORMAL"
        billingStatus="ACTIVE"
      />
    );
  }

  const [summary, membership] = await Promise.all([
    getReportSummary(user.id),
    getRequestMembershipContext(),
  ]);
  return (
    <ReportsPanel
      initialSummary={summary}
      membershipTier={membership.membershipTier}
      billingStatus={membership.membershipBillingStatus}
    />
  );
}
