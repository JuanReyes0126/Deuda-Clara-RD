import { prisma } from "@/lib/db/prisma";
import {
  hasCapability,
  resolveFeatureAccess,
  type CapabilityBooleanKey,
} from "@/lib/feature-access";
import type { MembershipBillingStatus, MembershipPlanId } from "@/lib/membership/plans";
import { ServiceError } from "@/server/services/service-error";

export async function getUserMembershipContext(
  userId: string,
): Promise<{
  membershipTier: MembershipPlanId;
  membershipBillingStatus: MembershipBillingStatus;
}> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      membershipTier: true,
      membershipBillingStatus: true,
    },
  });

  return {
    membershipTier: (settings?.membershipTier ?? "FREE") as MembershipPlanId,
    membershipBillingStatus:
      (settings?.membershipBillingStatus ?? "FREE") as MembershipBillingStatus,
  };
}

export async function getUserFeatureAccess(userId: string) {
  return resolveFeatureAccess(await getUserMembershipContext(userId));
}

export async function assertUserCapability(
  userId: string,
  capabilityKey: CapabilityBooleanKey,
  message = "Tu plan actual no tiene acceso a esta función.",
) {
  const access = await getUserFeatureAccess(userId);

  if (!hasCapability(access, capabilityKey)) {
    throw new ServiceError("FEATURE_LOCKED", 403, message);
  }

  return access;
}
