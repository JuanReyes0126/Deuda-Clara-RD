import { randomBytes } from "node:crypto";

import { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  type MembershipBillingStatus,
  type MembershipPlanId,
  getMembershipPlan,
} from "@/lib/membership/plans";
import type {
  CheckoutBillingIntervalInput,
  CheckoutSourceContext,
} from "@/lib/validations/billing";
import { createAuditLog } from "@/server/audit/audit-service";
import { createAzulBillingProvider, isAzulApprovedResponse, verifyAzulResponseHash } from "@/server/billing/providers/azul-provider";
import type { BillingProvider } from "@/server/billing/providers/types";
import {
  buildMembershipActivatedEmail,
  buildMembershipBillingAttentionEmail,
} from "@/server/mail/email-templates";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { logServerError } from "@/server/observability/logger";
import { ServiceError } from "@/server/services/service-error";

const billableMembershipTiers = ["NORMAL", "PRO"] as const;
const membershipBillingAccessStatuses = new Set<MembershipBillingStatus>(["ACTIVE"]);
const BILLING_EVENT_PROCESSING_STALE_MS = 10 * 60 * 1000;

type RequestMeta = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

export type BillableMembershipTier = (typeof billableMembershipTiers)[number];
type BillingInterval = "MONTHLY" | "ANNUAL";
type PaymentProviderEventStatus = "PROCESSING" | "PROCESSED" | "FAILED" | "SKIPPED";
type AzulReturnOutcome = "approved" | "declined" | "cancelled";
type BillingPaymentReturnAction = "APPROVE" | "DECLINE" | "CANCEL" | "IGNORE_ALREADY_APPROVED";

type BillingProviderProcessingDecision =
  | { shouldProcess: true }
  | { shouldProcess: false; reason: "duplicate" | "processing" };

export function isBillableMembershipTier(value: string): value is BillableMembershipTier {
  return (billableMembershipTiers as readonly string[]).includes(value);
}

export function hasBillingAccess(status: MembershipBillingStatus | null | undefined) {
  return status ? membershipBillingAccessStatuses.has(status) : false;
}

export function getBillingProviderEventProcessingDecision(input: {
  status: PaymentProviderEventStatus;
  updatedAt: Date;
  now?: Date;
}): BillingProviderProcessingDecision {
  if (input.status === "PROCESSED" || input.status === "SKIPPED") {
    return { shouldProcess: false, reason: "duplicate" };
  }

  if (input.status === "PROCESSING") {
    const now = input.now ?? new Date();
    const isStale = now.getTime() - input.updatedAt.getTime() > BILLING_EVENT_PROCESSING_STALE_MS;

    return isStale ? { shouldProcess: true } : { shouldProcess: false, reason: "processing" };
  }

  return { shouldProcess: true };
}

export function getBillingPaymentReturnAction(input: {
  currentStatus: "PENDING" | "APPROVED" | "DECLINED" | "CANCELED" | "FAILED";
  outcome: AzulReturnOutcome;
}): BillingPaymentReturnAction {
  if (input.currentStatus === "APPROVED" && input.outcome !== "approved") {
    return "IGNORE_ALREADY_APPROVED";
  }

  if (input.outcome === "approved") {
    return "APPROVE";
  }

  return input.outcome === "cancelled" ? "CANCEL" : "DECLINE";
}

function getBillingProvider(): BillingProvider {
  return createAzulBillingProvider();
}

export function isBillingConfigured() {
  return getBillingProvider().isConfigured();
}

function buildAbsoluteUrl(pathname: string) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return new URL(pathname, appUrl).toString();
}

function normalizeBillingInterval(input: CheckoutBillingIntervalInput | BillingInterval): BillingInterval {
  return input === "annual" || input === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

function getBillingAmountCents(membershipTier: BillableMembershipTier, billingInterval: BillingInterval) {
  const plan = getMembershipPlan(membershipTier);
  const amountUsd = billingInterval === "ANNUAL" ? plan.annualPriceUsd : plan.monthlyPriceUsd;

  if (amountUsd <= 0) {
    throw new ServiceError("BILLING_AMOUNT_INVALID", 400, "Ese plan no tiene precio de checkout.");
  }

  return amountUsd * 100;
}

function buildExternalPriceCode(membershipTier: BillableMembershipTier, billingInterval: BillingInterval) {
  return `azul_${membershipTier.toLowerCase()}_${billingInterval.toLowerCase()}_usd`;
}

function buildExternalOrderId() {
  return `DC${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`.slice(0, 15);
}

function addBillingInterval(date: Date, billingInterval: BillingInterval) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + (billingInterval === "ANNUAL" ? 12 : 1));

  return result;
}

async function beginBillingProviderEvent(input: {
  provider: "AZUL";
  externalEventId: string;
  eventType: string;
  payload?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.billingProviderEvent.create({
      data: {
        provider: input.provider,
        externalEventId: input.externalEventId,
        eventType: input.eventType,
        status: "PROCESSING",
        ...(input.payload === undefined ? {} : { payload: input.payload }),
      },
    });

    return { shouldProcess: true } as const;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
  }

  const existing = await prisma.billingProviderEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider: input.provider,
        externalEventId: input.externalEventId,
      },
    },
    select: {
      status: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return { shouldProcess: true } as const;
  }

  const decision = getBillingProviderEventProcessingDecision({
    status: existing.status,
    updatedAt: existing.updatedAt,
  });

  if (!decision.shouldProcess) {
    return decision;
  }

  await prisma.billingProviderEvent.update({
    where: {
      provider_externalEventId: {
        provider: input.provider,
        externalEventId: input.externalEventId,
      },
    },
    data: {
      eventType: input.eventType,
      status: "PROCESSING",
      ...(input.payload === undefined ? {} : { payload: input.payload }),
      processedAt: null,
      failedAt: null,
      errorMessage: null,
    },
  });

  return { shouldProcess: true } as const;
}

async function markBillingProviderEvent(input: {
  provider: "AZUL";
  externalEventId: string;
  status: "PROCESSED" | "SKIPPED" | "FAILED";
  error?: unknown;
}) {
  await prisma.billingProviderEvent.update({
    where: {
      provider_externalEventId: {
        provider: input.provider,
        externalEventId: input.externalEventId,
      },
    },
    data: {
      ...(input.status === "FAILED"
        ? {
            status: input.status,
            processedAt: null,
            failedAt: new Date(),
            errorMessage:
              input.error instanceof Error
                ? input.error.message.slice(0, 500)
                : "Unknown billing provider error",
          }
        : {
            status: input.status,
            processedAt: new Date(),
            failedAt: null,
            errorMessage: null,
          }),
    },
  });
}

export async function createMembershipCheckoutSession(
  userId: string,
  membershipTier: MembershipPlanId,
  billingIntervalInput: CheckoutBillingIntervalInput,
  meta: RequestMeta,
  sourceContext: CheckoutSourceContext = "planes",
) {
  if (!isBillableMembershipTier(membershipTier)) {
    throw new ServiceError("BILLING_PLAN_INVALID", 400, "Ese plan no se compra por checkout.");
  }

  const provider = getBillingProvider();

  if (!provider.isConfigured()) {
    throw new ServiceError(
      "BILLING_NOT_CONFIGURED",
      503,
      "La facturación con AZUL todavía no está configurada en este entorno.",
    );
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      settings: true,
    },
  });

  if (
    user.settings?.externalSubscriptionId &&
    hasBillingAccess((user.settings.membershipBillingStatus as MembershipBillingStatus | null | undefined) ?? null)
  ) {
    throw new ServiceError(
      "BILLING_ALREADY_ACTIVE",
      409,
      "Tu cuenta ya tiene un plan activo. Gestiona el cambio desde facturación.",
    );
  }

  const billingInterval = normalizeBillingInterval(billingIntervalInput);
  const amountCents = getBillingAmountCents(membershipTier, billingInterval);
  const externalPriceCode = buildExternalPriceCode(membershipTier, billingInterval);
  const externalOrderId = buildExternalOrderId();
  const checkout = provider.createCheckoutSession({
    userId: user.id,
    email: user.email,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    membershipTier,
    billingInterval,
    sourceContext,
    amountCents,
    currencyCode: "USD",
    externalPriceCode,
    externalOrderId,
    approvedUrl: buildAbsoluteUrl(`/api/billing/azul/approved?orderNumber=${externalOrderId}`),
    declinedUrl: buildAbsoluteUrl(`/api/billing/azul/declined?orderNumber=${externalOrderId}`),
    cancelUrl: buildAbsoluteUrl(`/api/billing/azul/cancelled?orderNumber=${externalOrderId}`),
  });

  await prisma.$transaction([
    prisma.billingPayment.create({
      data: {
        userId: user.id,
        provider: "AZUL",
        membershipTier,
        billingInterval,
        externalOrderId,
        externalPriceCode,
        amountCents,
        currency: "USD",
        status: "PENDING",
        metadata: {
          sourceContext,
          email: user.email,
          fullName: `${user.firstName} ${user.lastName}`.trim(),
        },
      },
    }),
    prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        membershipBillingStatus: "PENDING",
        billingInterval,
        externalPaymentProvider: "AZUL",
        externalPriceCode,
      },
      update: {
        membershipBillingStatus:
          user.settings?.membershipBillingStatus === "ACTIVE"
            ? user.settings.membershipBillingStatus
            : "PENDING",
        billingInterval,
        externalPaymentProvider: "AZUL",
        externalPriceCode,
      },
    }),
  ]);

  await createAuditLog({
    userId,
    action: AuditAction.BILLING_CHECKOUT_CREATED,
    resourceType: "billing",
    resourceId: externalOrderId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      provider: "AZUL",
      membershipTier,
      billingInterval,
      externalPriceCode,
      sourceContext,
    },
  });

  return checkout;
}

export async function createBillingPortalSession(..._args: [string?, RequestMeta?]) {
  void _args;

  throw new ServiceError(
    "BILLING_PORTAL_UNAVAILABLE",
    501,
    "AZUL no tiene portal de autoservicio conectado todavía. La gestión de renovación queda preparada para la fase de tokenización.",
  );
}

function normalizeAzulParams(params: URLSearchParams | Record<string, string | undefined>) {
  if (params instanceof URLSearchParams) {
    return Object.fromEntries(params.entries());
  }

  return params;
}

function getAzulOrderNumber(params: Record<string, string | undefined>) {
  return params.orderNumber ?? params.OrderNumber ?? params.ordernumber ?? null;
}

function getAzulTransactionId(params: Record<string, string | undefined>) {
  return params.AzulOrderId ?? params.RRN ?? params.AuthorizationCode ?? null;
}

async function activateMembershipFromApprovedPayment(input: {
  paymentId: string;
  userId: string;
  membershipTier: BillableMembershipTier;
  billingInterval: BillingInterval;
  externalOrderId: string;
  externalTransactionId: string | null;
  externalPriceCode: string;
}) {
  const now = new Date();
  const currentPeriodEnd = addBillingInterval(now, input.billingInterval);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    include: { settings: true },
  });
  const previousTier = (user.settings?.membershipTier as MembershipPlanId | null | undefined) ?? "FREE";
  const previousStatus =
    (user.settings?.membershipBillingStatus as MembershipBillingStatus | null | undefined) ?? "FREE";
  const previousCancelAtPeriodEnd = user.settings?.membershipCancelAtPeriodEnd ?? false;

  await prisma.$transaction([
    prisma.billingPayment.update({
      where: { id: input.paymentId },
      data: {
        status: "APPROVED",
        approvedAt: now,
        externalTransactionId: input.externalTransactionId,
      },
    }),
    prisma.userSettings.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        membershipTier: input.membershipTier,
        membershipBillingStatus: "ACTIVE",
        billingInterval: input.billingInterval,
        membershipActivatedAt: now,
        membershipCurrentPeriodEnd: currentPeriodEnd,
        membershipCancelAtPeriodEnd: false,
        externalPaymentProvider: "AZUL",
        externalSubscriptionId: null,
        externalPriceCode: input.externalPriceCode,
      },
      update: {
        membershipTier: input.membershipTier,
        membershipBillingStatus: "ACTIVE",
        billingInterval: input.billingInterval,
        membershipActivatedAt: now,
        membershipCurrentPeriodEnd: currentPeriodEnd,
        membershipCancelAtPeriodEnd: false,
        externalPaymentProvider: "AZUL",
        externalSubscriptionId: null,
        externalPriceCode: input.externalPriceCode,
      },
    }),
  ]);

  await createAuditLog({
    userId: input.userId,
    action: AuditAction.BILLING_PAYMENT_CONFIRMED,
    resourceType: "billing",
    resourceId: input.externalOrderId,
    metadata: {
      provider: "AZUL",
      membershipTier: input.membershipTier,
      billingInterval: input.billingInterval,
      externalTransactionId: input.externalTransactionId,
      externalPriceCode: input.externalPriceCode,
    },
  });

  await maybeSendMembershipLifecycleEmail({
    email: user.email,
    firstName: user.firstName,
    previousTier,
    previousStatus,
    previousCancelAtPeriodEnd,
    nextTier: input.membershipTier,
    nextStatus: "ACTIVE",
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
  });
}

export async function handleAzulPaymentReturn(outcome: AzulReturnOutcome, paramsInput: URLSearchParams | Record<string, string | undefined>) {
  const params = normalizeAzulParams(paramsInput);
  const externalOrderId = getAzulOrderNumber(params);

  if (!externalOrderId) {
    throw new ServiceError("BILLING_ORDER_MISSING", 400, "La respuesta de AZUL no trae número de orden.");
  }

  const externalTransactionId = getAzulTransactionId(params);
  const externalEventId = `${outcome}:${externalOrderId}:${externalTransactionId ?? "return"}`;
  const processing = await beginBillingProviderEvent({
    provider: "AZUL",
    externalEventId,
    eventType: `azul.${outcome}`,
    payload: params as Prisma.InputJsonObject,
  });

  if (!processing.shouldProcess) {
    return { checkout: processing.reason, orderNumber: externalOrderId };
  }

  try {
    const payment = await prisma.billingPayment.findUnique({
      where: { externalOrderId },
    });

    if (!payment) {
      throw new ServiceError("BILLING_PAYMENT_NOT_FOUND", 404, "No se encontró el cobro pendiente de AZUL.");
    }

    if (params.Amount && Number(params.Amount) !== payment.amountCents) {
      throw new ServiceError("BILLING_AMOUNT_MISMATCH", 400, "El monto confirmado por AZUL no coincide.");
    }

    if (!params.AuthHash) {
      throw new ServiceError("BILLING_SIGNATURE_MISSING", 403, "La respuesta de AZUL no trae firma.");
    }

    if (!verifyAzulResponseHash(params)) {
      throw new ServiceError("BILLING_SIGNATURE_INVALID", 403, "La firma de AZUL no es válida.");
    }

    const returnAction = getBillingPaymentReturnAction({
      currentStatus: payment.status,
      outcome,
    });

    if (returnAction === "IGNORE_ALREADY_APPROVED") {
      await markBillingProviderEvent({ provider: "AZUL", externalEventId, status: "PROCESSED" });

      return { checkout: "success", orderNumber: externalOrderId };
    }

    if (returnAction === "APPROVE" && isAzulApprovedResponse(params)) {
      if (payment.status !== "APPROVED") {
        await activateMembershipFromApprovedPayment({
          paymentId: payment.id,
          userId: payment.userId,
          membershipTier: payment.membershipTier as BillableMembershipTier,
          billingInterval: payment.billingInterval as BillingInterval,
          externalOrderId,
          externalTransactionId,
          externalPriceCode: payment.externalPriceCode,
        });
      }

      await markBillingProviderEvent({ provider: "AZUL", externalEventId, status: "PROCESSED" });

      return { checkout: "success", orderNumber: externalOrderId };
    }

    await prisma.billingPayment.update({
      where: { id: payment.id },
      data:
        returnAction === "CANCEL"
          ? { status: "CANCELED", canceledAt: new Date(), externalTransactionId }
          : { status: "DECLINED", declinedAt: new Date(), externalTransactionId },
    });
    await markBillingProviderEvent({ provider: "AZUL", externalEventId, status: "PROCESSED" });

    return {
      checkout: outcome === "cancelled" ? "cancelled" : "declined",
      orderNumber: externalOrderId,
    };
  } catch (error) {
    await markBillingProviderEvent({ provider: "AZUL", externalEventId, status: "FAILED", error });
    throw error;
  }
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
