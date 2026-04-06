import { MembershipPanel } from "@/features/membership/components/membership-panel";
import { membershipConversionSnapshot } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { membershipPlanCatalog, type MembershipPlanId } from "@/lib/membership/plans";
import { isStripeBillingConfigured } from "@/server/billing/billing-service";
import { getMembershipConversionSnapshot } from "@/server/dashboard/dashboard-service";
import { getRequestSessionUser } from "@/server/request/request-user-context";
import { getUserSettingsViewModel } from "@/server/settings/settings-service";

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getRequestSessionUser();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedPlan = getSingleValue(resolvedSearchParams.plan);
  const requestedSource = getSingleValue(resolvedSearchParams.source);
  const highlightPlanId =
    requestedPlan && requestedPlan in membershipPlanCatalog
      ? (requestedPlan as MembershipPlanId)
      : null;
  const sourceContext =
    requestedSource === "simulador" ||
    requestedSource === "dashboard" ||
    requestedSource === "reportes" ||
    requestedSource === "notificaciones"
      ? requestedSource
      : null;

  if (isDemoSessionUser(user)) {
    return (
      <MembershipPanel
        currentTier="NORMAL"
        billingStatus="ACTIVE"
        billingConfigured
        canManageBilling
        currentPeriodEnd="2026-04-29T12:00:00.000Z"
        cancelAtPeriodEnd={false}
        highlightPlanId={highlightPlanId}
        sourceContext={sourceContext}
        conversionSnapshot={membershipConversionSnapshot}
        demoMode
      />
    );
  }

  const [settingsViewModel, conversionSnapshot] = await Promise.all([
    getUserSettingsViewModel(user.id),
    getMembershipConversionSnapshot(user.id),
  ]);
  const settings = settingsViewModel.settings;

  return (
    <MembershipPanel
      currentTier={(settings?.membershipTier ?? "FREE") as "FREE" | "NORMAL" | "PRO"}
      billingStatus={(settings?.membershipBillingStatus ?? "FREE") as "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE"}
      billingConfigured={isStripeBillingConfigured()}
      canManageBilling={settings?.canManageBilling ?? false}
      currentPeriodEnd={settings?.membershipCurrentPeriodEnd ?? null}
      cancelAtPeriodEnd={settings?.membershipCancelAtPeriodEnd ?? false}
      highlightPlanId={highlightPlanId}
      sourceContext={sourceContext}
      conversionSnapshot={conversionSnapshot}
    />
  );
}
