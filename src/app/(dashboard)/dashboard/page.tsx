import { redirect } from "next/navigation";

import { dashboardData, membershipConversionSnapshot } from "@/lib/demo/data";
import { DEMO_USER_ID, isDemoSessionUser } from "@/lib/demo/session";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import {
  getDashboardPageData,
} from "@/server/dashboard/dashboard-service";
import { getRequestSessionUser } from "@/server/request/request-user-context";

function getSingleValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getRequestSessionUser();

  if (isDemoSessionUser(user)) {
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const premiumWelcome = getSingleValue(resolvedSearchParams.welcome) === "premium";
    const initialShowOptimization = getSingleValue(resolvedSearchParams.focus) === "optimization";

    return (
      <DashboardOverview
        data={dashboardData}
        conversionSnapshot={membershipConversionSnapshot}
        premiumWelcome={premiumWelcome}
        initialShowOptimization={initialShowOptimization}
        claraStorageKey={DEMO_USER_ID}
      />
    );
  }

  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const premiumWelcome = getSingleValue(resolvedSearchParams.welcome) === "premium";
  const initialShowOptimization = getSingleValue(resolvedSearchParams.focus) === "optimization";
  const { data, conversionSnapshot } = await getDashboardPageData(user.id);

  return (
    <DashboardOverview
      data={data}
      conversionSnapshot={conversionSnapshot}
      premiumWelcome={premiumWelcome}
      initialShowOptimization={initialShowOptimization}
      claraStorageKey={user.id}
    />
  );
}
