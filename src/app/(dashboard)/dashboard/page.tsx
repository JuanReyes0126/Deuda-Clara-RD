import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { dashboardData, membershipConversionSnapshot } from "@/lib/demo/data";
import { isDemoSessionUser } from "@/lib/demo/session";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import {
  getDashboardData,
  getMembershipConversionSnapshot,
} from "@/server/dashboard/dashboard-service";

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
  const user = await requireUser();

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
      />
    );
  }

  if (!user.onboardingCompleted) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const premiumWelcome = getSingleValue(resolvedSearchParams.welcome) === "premium";
  const initialShowOptimization = getSingleValue(resolvedSearchParams.focus) === "optimization";
  const [data, conversionSnapshot] = await Promise.all([
    getDashboardData(user.id),
    getMembershipConversionSnapshot(user.id),
  ]);

  return (
    <DashboardOverview
      data={data}
      conversionSnapshot={conversionSnapshot}
      premiumWelcome={premiumWelcome}
      initialShowOptimization={initialShowOptimization}
    />
  );
}
