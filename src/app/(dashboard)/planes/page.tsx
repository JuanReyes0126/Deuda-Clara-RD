import { MembershipPanel } from "@/features/membership/components/membership-panel";
import { requireUser } from "@/lib/auth/session";
import { membershipConversionSnapshot } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { membershipPlanCatalog, type MembershipPlanId } from "@/lib/membership/plans";
import { isStripeBillingConfigured } from "@/server/billing/billing-service";
import { getMembershipConversionSnapshot } from "@/server/dashboard/dashboard-service";
import { getUserSettingsBundle } from "@/server/settings/settings-service";

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
  const user = await requireUser();
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

  const [settingsBundle, conversionSnapshot] = await Promise.all([
    getUserSettingsBundle(user.id),
    getMembershipConversionSnapshot(user.id),
  ]);
  const settings = settingsBundle.settings;

  return (
    <MembershipPanel
      currentTier={(settings?.membershipTier ?? "FREE") as "FREE" | "NORMAL" | "PRO"}
      billingStatus={(settings?.membershipBillingStatus ?? "FREE") as "FREE" | "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INACTIVE"}
      billingConfigured={isStripeBillingConfigured()}
      canManageBilling={Boolean(settings?.stripeCustomerId)}
      currentPeriodEnd={settings?.membershipCurrentPeriodEnd?.toISOString() ?? null}
      cancelAtPeriodEnd={settings?.membershipCancelAtPeriodEnd ?? false}
      highlightPlanId={highlightPlanId}
      sourceContext={sourceContext}
      conversionSnapshot={conversionSnapshot}
    />
  );
}
