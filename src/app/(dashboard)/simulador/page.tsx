import { SimulatorPanel } from "@/features/simulator/components/simulator-panel";
import { isDemoSessionUser } from "@/lib/demo/session";
import { listUserDebts } from "@/server/debts/debt-service";
import {
  buildMembershipConversionSnapshot,
} from "@/server/dashboard/dashboard-service";
import { getRequestSessionUser } from "@/server/request/request-user-context";
import { getUserSettingsViewModel } from "@/server/settings/settings-service";

export default async function SimulatorPage() {
  const user = await getRequestSessionUser();

  if (isDemoSessionUser(user)) {
    const debts = await listUserDebts(user.id, false);

    return (
      <SimulatorPanel
        debts={debts}
        preferredStrategy="AVALANCHE"
        conversionSnapshot={buildMembershipConversionSnapshot({
          debts,
          preferredStrategy: "AVALANCHE",
          monthlyIncome: 55000,
          monthlyHousingCost: 14000,
          monthlyGroceriesCost: 9000,
          monthlyUtilitiesCost: 4500,
          monthlyTransportCost: 5000,
          monthlyOtherEssentialExpenses: 2500,
          monthlyDebtBudget: 22000,
          hybridRateWeight: 70,
          hybridBalanceWeight: 30,
        })}
        membershipTier="NORMAL"
        billingStatus="ACTIVE"
      />
    );
  }

  const [debts, settingsViewModel] = await Promise.all([
    listUserDebts(user.id, false),
    getUserSettingsViewModel(user.id),
  ]);
  const conversionSnapshot = buildMembershipConversionSnapshot({
    debts,
    preferredStrategy: settingsViewModel.settings?.preferredStrategy ?? "AVALANCHE",
    monthlyIncome: settingsViewModel.settings?.monthlyIncome ?? null,
    monthlyHousingCost: settingsViewModel.settings?.monthlyHousingCost ?? null,
    monthlyGroceriesCost: settingsViewModel.settings?.monthlyGroceriesCost ?? null,
    monthlyUtilitiesCost: settingsViewModel.settings?.monthlyUtilitiesCost ?? null,
    monthlyTransportCost: settingsViewModel.settings?.monthlyTransportCost ?? null,
    monthlyOtherEssentialExpenses:
      settingsViewModel.settings?.monthlyOtherEssentialExpenses ?? null,
    monthlyDebtBudget: settingsViewModel.settings?.monthlyDebtBudget ?? null,
    hybridRateWeight: settingsViewModel.settings?.hybridRateWeight ?? 70,
    hybridBalanceWeight: settingsViewModel.settings?.hybridBalanceWeight ?? 30,
  });

  return (
    <SimulatorPanel
      debts={debts}
      preferredStrategy={settingsViewModel.settings?.preferredStrategy ?? "AVALANCHE"}
      conversionSnapshot={conversionSnapshot}
      membershipTier={(settingsViewModel.settings?.membershipTier ?? "FREE") as "FREE" | "NORMAL" | "PRO"}
      billingStatus={
        (settingsViewModel.settings?.membershipBillingStatus ?? "FREE") as
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
