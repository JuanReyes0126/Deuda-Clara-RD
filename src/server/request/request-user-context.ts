import { cache } from "react";

import { requireSessionUser, requireUser } from "@/lib/auth/session";
import { isDemoSessionUser } from "@/lib/demo/session";
import type { AppShellUserDto } from "@/lib/types/app";
import { getUserMembershipContext } from "@/server/membership/membership-access-service";

export const getRequestSessionUser = cache(async () => requireSessionUser());
export const getRequestServerUser = cache(async () => requireUser());

export const getRequestMembershipContext = cache(async () => {
  const user = await getRequestSessionUser();

  if (isDemoSessionUser(user)) {
    return {
      membershipTier: "NORMAL" as const,
      membershipBillingStatus: "ACTIVE" as const,
    };
  }

  return getUserMembershipContext(user.id);
});

export const getRequestAppShellUser = cache(async (): Promise<AppShellUserDto> => {
  const user = await getRequestSessionUser();
  const membership = await getRequestMembershipContext();

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    membershipTier: membership.membershipTier === "PRO" ? "PRO" : membership.membershipTier === "NORMAL" ? "NORMAL" : "FREE",
  };
});
