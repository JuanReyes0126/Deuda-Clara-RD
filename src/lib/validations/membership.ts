import { z } from "zod";

export const membershipPlanSchema = z.object({
  membershipTier: z.enum(["FREE", "NORMAL", "PRO"]),
});

export type MembershipPlanInput = z.infer<typeof membershipPlanSchema>;
