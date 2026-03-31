import { ReportsPanel } from "@/features/reports/components/reports-panel";
import { requireUser } from "@/lib/auth/session";
import { reportSummary } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { hasMembershipAccess } from "@/lib/membership/plans";
import { getReportSummary } from "@/server/reports/report-service";
import { getUserSettingsBundle } from "@/server/settings/settings-service";

export default async function ReportsPage() {
  const user = await requireUser();

  if (isDemoSessionUser(user)) {
    return <ReportsPanel initialSummary={reportSummary} premiumInsightsEnabled />;
  }

  const [summary, settingsBundle] = await Promise.all([
    getReportSummary(user.id),
    getUserSettingsBundle(user.id),
  ]);
  const premiumInsightsEnabled = hasMembershipAccess(
    settingsBundle.settings?.membershipTier,
    settingsBundle.settings?.membershipBillingStatus ?? "FREE",
  );

  return <ReportsPanel initialSummary={summary} premiumInsightsEnabled={premiumInsightsEnabled} />;
}
