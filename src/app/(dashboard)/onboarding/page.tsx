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
        monthlyDebtBudget: Number(user.settings?.monthlyDebtBudget ?? 0),
        debts: [],
      }}
    />
  );
}
