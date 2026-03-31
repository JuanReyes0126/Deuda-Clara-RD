import { SimulatorPanel } from "@/features/simulator/components/simulator-panel";
import { requireUser } from "@/lib/auth/session";
import { isDemoSessionUser } from "@/lib/demo/session";
import { listUserDebts } from "@/server/debts/debt-service";
import {
  buildMembershipConversionSnapshot,
  getMembershipConversionSnapshot,
} from "@/server/dashboard/dashboard-service";
import { getUserSettingsBundle } from "@/server/settings/settings-service";

export default async function SimulatorPage() {
  const user = await requireUser();

  if (isDemoSessionUser(user)) {
    const debts = await listUserDebts(user.id, false);

    return (
      <SimulatorPanel
        debts={debts}
        conversionSnapshot={buildMembershipConversionSnapshot({
          debts,
          preferredStrategy: "AVALANCHE",
          monthlyDebtBudget: 22000,
          hybridRateWeight: 70,
          hybridBalanceWeight: 30,
        })}
        membershipTier="NORMAL"
        billingStatus="ACTIVE"
      />
    );
  }

  const [debts, settingsBundle, conversionSnapshot] = await Promise.all([
    listUserDebts(user.id, false),
    getUserSettingsBundle(user.id),
    getMembershipConversionSnapshot(user.id),
  ]);

  return (
    <SimulatorPanel
      debts={debts}
      conversionSnapshot={conversionSnapshot}
      membershipTier={(settingsBundle.settings?.membershipTier ?? "FREE") as "FREE" | "NORMAL" | "PRO"}
      billingStatus={
        (settingsBundle.settings?.membershipBillingStatus ?? "FREE") as
          | "FREE"
          | "PENDING"
          | "ACTIVE"
          | "PAST_DUE"
          | "CANCELED"
          | "INACTIVE"
      }
    />
  );
}
