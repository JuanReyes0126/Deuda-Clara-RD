import type { BillingInterval, BillingPaymentProvider, MembershipTier } from "@prisma/client";

import type { CheckoutSourceContext } from "@/lib/validations/billing";

export type BillingCheckoutSession = {
  provider: BillingPaymentProvider;
  mode: "form_post";
  method: "POST";
  url: string;
  fields: Record<string, string>;
  externalOrderId: string;
  externalPriceCode: string;
};

export type CreateBillingCheckoutInput = {
  userId: string;
  email: string;
  fullName: string;
  membershipTier: Exclude<MembershipTier, "FREE">;
  billingInterval: BillingInterval;
  sourceContext: CheckoutSourceContext;
  amountCents: number;
  currencyCode: "USD";
  externalPriceCode: string;
  approvedUrl: string;
  declinedUrl: string;
  cancelUrl: string;
  externalOrderId: string;
};

export interface BillingProvider {
  provider: BillingPaymentProvider;
  isConfigured(): boolean;
  createCheckoutSession(input: CreateBillingCheckoutInput): BillingCheckoutSession;
}
