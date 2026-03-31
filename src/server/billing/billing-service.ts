import { AuditAction } from "@prisma/client";
import Stripe from "stripe";

import { prisma } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env/server";
import {
  type MembershipBillingStatus,
  type MembershipPlanId,
  getMembershipPlan,
} from "@/lib/membership/plans";
import type { CheckoutSourceContext } from "@/lib/validations/billing";
import { createAuditLog } from "@/server/audit/audit-service";
import {
  buildMembershipActivatedEmail,
  buildMembershipBillingAttentionEmail,
} from "@/server/mail/email-templates";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { logServerError } from "@/server/observability/logger";
import { ServiceError } from "@/server/services/service-error";

const billableMembershipTiers = ["NORMAL", "PRO"] as const;
const membershipBillingAccessStatuses = new Set<MembershipBillingStatus>(["ACTIVE"]);

type RequestMeta = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

export type BillableMembershipTier = (typeof billableMembershipTiers)[number];

declare global {
  var __stripeClient: Stripe | undefined;
}

export function isBillableMembershipTier(value: string): value is BillableMembershipTier {
  return (billableMembershipTiers as readonly string[]).includes(value);
}

export function mapStripeSubscriptionStatus(status: string): MembershipBillingStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "INACTIVE";
    default:
      return "PENDING";
  }
}

export function hasBillingAccess(status: MembershipBillingStatus | null | undefined) {
  return status ? membershipBillingAccessStatuses.has(status) : false;
}

export function isStripeBillingConfigured() {
  const env = getServerEnv();

  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PREMIUM_PRICE_ID &&
      env.STRIPE_PRO_PRICE_ID,
  );
}

function getStripeClient() {
  const env = getServerEnv();

  if (!env.STRIPE_SECRET_KEY) {
    throw new ServiceError(
      "BILLING_NOT_CONFIGURED",
      503,
      "La facturación premium todavía no está configurada en este entorno.",
    );
  }

  if (!global.__stripeClient) {
    global.__stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }

  return global.__stripeClient;
}

function getBillingPriceMap() {
  const env = getServerEnv();

  if (!env.STRIPE_PREMIUM_PRICE_ID || !env.STRIPE_PRO_PRICE_ID) {
    throw new ServiceError(
      "BILLING_PRICE_NOT_CONFIGURED",
      503,
      "Faltan los precios de Premium y Pro en la configuración de Stripe.",
    );
  }

  return {
    NORMAL: env.STRIPE_PREMIUM_PRICE_ID,
    PRO: env.STRIPE_PRO_PRICE_ID,
  } satisfies Record<BillableMembershipTier, string>;
}

function buildAbsoluteUrl(pathname: string) {
  const env = getServerEnv();
  const appUrl = env.APP_URL ?? "http://localhost:3000";

  return new URL(pathname, appUrl).toString();
}

function getPortalReturnUrl() {
  const env = getServerEnv();
  const returnPath = env.STRIPE_PORTAL_RETURN_PATH ?? "/planes";

  return buildAbsoluteUrl(returnPath);
}

export function resolveMembershipTierFromPriceId(
  priceId: string,
  priceMap: Record<BillableMembershipTier, string>,
): BillableMembershipTier {
  const match = (Object.entries(priceMap) as Array<[BillableMembershipTier, string]>).find(
    ([, configuredPriceId]) => configuredPriceId === priceId,
  );

  if (!match) {
    throw new ServiceError(
      "BILLING_PRICE_UNKNOWN",
      400,
      "No se pudo relacionar el precio de Stripe con un plan de Deuda Clara RD.",
    );
  }

  return match[0];
}

async function ensureStripeCustomer(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
    },
  });

  if (user.settings?.stripeCustomerId) {
    return user.settings.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: {
      userId: user.id,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customer.id,
    },
    update: {
      stripeCustomerId: customer.id,
    },
  });

  return customer.id;
}

export async function createMembershipCheckoutSession(
  userId: string,
  membershipTier: MembershipPlanId,
  meta: RequestMeta,
  sourceContext: CheckoutSourceContext = "planes",
) {
  if (!isBillableMembershipTier(membershipTier)) {
    throw new ServiceError("BILLING_PLAN_INVALID", 400, "Ese plan no se compra por checkout.");
  }

  if (!isStripeBillingConfigured()) {
    throw new ServiceError(
      "BILLING_NOT_CONFIGURED",
      503,
      "La facturación premium todavía no está configurada en este entorno.",
    );
  }

  const priceMap = getBillingPriceMap();
  const stripe = getStripeClient();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
    },
  });

  if (
    user.settings?.stripeSubscriptionId &&
    hasBillingAccess((user.settings.membershipBillingStatus as MembershipBillingStatus | null | undefined) ?? null)
  ) {
    throw new ServiceError(
      "BILLING_ALREADY_ACTIVE",
      409,
      "Tu cuenta ya tiene un plan activo. Gestiona el cambio desde facturación.",
    );
  }

  const customerId = await ensureStripeCustomer(userId);
  const successPath = `/planes?checkout=success&plan=${membershipTier}&source=${sourceContext}`;
  const cancelPath = `/planes?checkout=cancelled&plan=${membershipTier}&source=${sourceContext}`;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    success_url: buildAbsoluteUrl(successPath),
    cancel_url: buildAbsoluteUrl(cancelPath),
    line_items: [
      {
        price: priceMap[membershipTier],
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      membershipTier,
      sourceContext,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        membershipTier,
        sourceContext,
      },
    },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: customerId,
      membershipBillingStatus: "PENDING",
    },
    update: {
      stripeCustomerId: customerId,
      membershipBillingStatus:
        user.settings?.membershipBillingStatus === "ACTIVE"
          ? user.settings.membershipBillingStatus
          : "PENDING",
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.BILLING_CHECKOUT_CREATED,
    resourceType: "billing",
    resourceId: checkoutSession.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      membershipTier,
      stripeCustomerId: customerId,
      sourceContext,
    },
  });

  if (!checkoutSession.url) {
    throw new ServiceError("BILLING_CHECKOUT_FAILED", 500, "No se pudo abrir el checkout.");
  }

  return {
    url: checkoutSession.url,
  };
}

export async function createBillingPortalSession(userId: string, meta: RequestMeta) {
  if (!isStripeBillingConfigured()) {
    throw new ServiceError(
      "BILLING_NOT_CONFIGURED",
      503,
      "La facturación premium todavía no está configurada en este entorno.",
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
    },
  });
  const customerId = user.settings?.stripeCustomerId ?? (await ensureStripeCustomer(userId));
  const stripe = getStripeClient();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: getPortalReturnUrl(),
  });

  await createAuditLog({
    userId,
    action: AuditAction.BILLING_PORTAL_OPENED,
    resourceType: "billing",
    resourceId: portalSession.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      stripeCustomerId: customerId,
    },
  });

  return {
    url: portalSession.url,
  };
}

async function findTargetUserIdForSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userIdFromMetadata = subscription.metadata.userId;

  if (userIdFromMetadata) {
    return userIdFromMetadata;
  }

  const settings = await prisma.userSettings.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { stripeSubscriptionId: subscription.id },
      ],
    },
    select: {
      userId: true,
    },
  });

  return settings?.userId ?? null;
}

export async function syncMembershipFromStripeSubscription(subscription: Stripe.Subscription) {
  const userId = await findTargetUserIdForSubscription(subscription);

  if (!userId) {
    throw new ServiceError(
      "BILLING_USER_NOT_FOUND",
      404,
      "No se pudo relacionar la suscripción de Stripe con un usuario.",
    );
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price?.id;

  if (!priceId) {
    throw new ServiceError(
      "BILLING_PRICE_MISSING",
      400,
      "La suscripción de Stripe no trae un precio válido.",
    );
  }

  const nextTier = resolveMembershipTierFromPriceId(priceId, getBillingPriceMap());
  const billingStatus = mapStripeSubscriptionStatus(subscription.status);
  const shouldKeepTier = billingStatus === "ACTIVE" || billingStatus === "PAST_DUE";
  const membershipTier = shouldKeepTier ? nextTier : "FREE";
  const membershipActivatedAt = shouldKeepTier ? new Date(subscription.start_date * 1000) : null;
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000)
    : null;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
    },
  });
  const previousTier = (user.settings?.membershipTier as MembershipPlanId | null | undefined) ?? "FREE";
  const previousStatus =
    (user.settings?.membershipBillingStatus as MembershipBillingStatus | null | undefined) ?? "FREE";
  const previousCancelAtPeriodEnd = user.settings?.membershipCancelAtPeriodEnd ?? false;

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      membershipTier,
      membershipBillingStatus: billingStatus,
      membershipActivatedAt,
      membershipCurrentPeriodEnd: currentPeriodEnd,
      membershipCancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: customerId,
      stripeSubscriptionId: shouldKeepTier ? subscription.id : null,
      stripePriceId: shouldKeepTier ? priceId : null,
    },
    update: {
      membershipTier,
      membershipBillingStatus: billingStatus,
      membershipActivatedAt,
      membershipCurrentPeriodEnd: currentPeriodEnd,
      membershipCancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId: customerId,
      stripeSubscriptionId: shouldKeepTier ? subscription.id : null,
      stripePriceId: shouldKeepTier ? priceId : null,
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.BILLING_WEBHOOK_SYNCED,
    resourceType: "billing",
    resourceId: subscription.id,
    metadata: {
      membershipTier,
      membershipBillingStatus: billingStatus,
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  await maybeSendMembershipLifecycleEmail({
    email: user.email,
    firstName: user.firstName,
    previousTier,
    previousStatus,
    previousCancelAtPeriodEnd,
    nextTier: membershipTier,
    nextStatus: billingStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  return settings;
}

async function maybeSendMembershipLifecycleEmail(input: {
  email: string;
  firstName: string | null;
  previousTier: MembershipPlanId;
  previousStatus: MembershipBillingStatus;
  previousCancelAtPeriodEnd: boolean;
  nextTier: MembershipPlanId;
  nextStatus: MembershipBillingStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  try {
    if (
      input.nextStatus === "ACTIVE" &&
      (input.previousStatus !== "ACTIVE" || input.previousTier !== input.nextTier)
    ) {
      const activePlan = getMembershipPlan(input.nextTier);
      const email = buildMembershipActivatedEmail({
        firstName: input.firstName,
        planLabel: activePlan.label,
        currentPeriodEnd: input.currentPeriodEnd,
      });

      await sendTransactionalEmail({
        to: input.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      return;
    }

    if (input.nextStatus === "PAST_DUE" && input.previousStatus !== "PAST_DUE") {
      const attentionEmail = buildMembershipBillingAttentionEmail({
        planLabel: getMembershipPlan(input.nextTier).label,
        status: "PAST_DUE",
      });

      await sendTransactionalEmail({
        to: input.email,
        subject: attentionEmail.subject,
        html: attentionEmail.html,
        text: attentionEmail.text,
      });

      return;
    }

    if (
      (input.nextStatus === "CANCELED" && input.previousStatus !== "CANCELED") ||
      (input.cancelAtPeriodEnd && !input.previousCancelAtPeriodEnd)
    ) {
      const canceledEmail = buildMembershipBillingAttentionEmail({
        planLabel: getMembershipPlan(input.previousTier === "FREE" ? input.nextTier : input.previousTier).label,
        status: "CANCELED",
      });

      await sendTransactionalEmail({
        to: input.email,
        subject: canceledEmail.subject,
        html: canceledEmail.html,
        text: canceledEmail.text,
      });
    }
  } catch (error) {
    logServerError("Membership lifecycle email failed", {
      email: input.email,
      previousTier: input.previousTier,
      previousStatus: input.previousStatus,
      nextTier: input.nextTier,
      nextStatus: input.nextStatus,
      error,
    });
  }
}

export async function syncMembershipFromStripeCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  if (userId && customerId) {
    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        stripeCustomerId: customerId,
        membershipBillingStatus: "PENDING",
      },
      update: {
        stripeCustomerId: customerId,
        membershipBillingStatus: "PENDING",
      },
    });
  }

  if (typeof session.subscription !== "string") {
    return null;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  return syncMembershipFromStripeSubscription(subscription);
}

export async function handleStripeWebhook(rawBody: string, signature: string) {
  const env = getServerEnv();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new ServiceError(
      "BILLING_WEBHOOK_NOT_CONFIGURED",
      503,
      "El webhook de Stripe no está configurado.",
    );
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case "checkout.session.completed":
      await syncMembershipFromStripeCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncMembershipFromStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return event.type;
}
