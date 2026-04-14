import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getRequestServerUser } from "@/server/request/request-user-context";

export default async function OnboardingPage() {
  const user = await getRequestServerUser();

  if (user.onboardingCompleted) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      defaultValues={{
        monthlyIncome: Number(user.settings?.monthlyIncome ?? 0),
        monthlyHousingCost: Number(user.settings?.monthlyHousingCost ?? 0),
        monthlyGroceriesCost: Number(user.settings?.monthlyGroceriesCost ?? 0),
        monthlyUtilitiesCost: Number(user.settings?.monthlyUtilitiesCost ?? 0),
        monthlyTransportCost: Number(user.settings?.monthlyTransportCost ?? 0),
        monthlyOtherEssentialExpenses: Number(
          user.settings?.monthlyOtherEssentialExpenses ?? 0,
        ),
        monthlyDebtBudget: Number(user.settings?.monthlyDebtBudget ?? 0),
        debts: [],
      }}
    />
  );
}
