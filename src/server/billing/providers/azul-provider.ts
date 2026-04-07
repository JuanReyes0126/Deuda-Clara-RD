import { createHmac } from "node:crypto";

import type { BillingProvider, CreateBillingCheckoutInput } from "@/server/billing/providers/types";
import { getServerEnv } from "@/lib/env/server";
import { ServiceError } from "@/server/services/service-error";

type AzulCheckoutFields = {
  MerchantId: string;
  MerchantName: string;
  MerchantType: string;
  CurrencyCode: string;
  OrderNumber: string;
  Amount: string;
  ITBIS: string;
  ApprovedUrl: string;
  DeclinedUrl: string;
  CancelUrl: string;
  AuthHash: string;
};

const azulCheckoutHashFields = [
  "MerchantId",
  "MerchantName",
  "MerchantType",
  "CurrencyCode",
  "OrderNumber",
  "Amount",
  "ITBIS",
  "ApprovedUrl",
  "DeclinedUrl",
  "CancelUrl",
] as const;

const azulResponseHashFields = [
  "OrderNumber",
  "Amount",
  "AuthorizationCode",
  "DateTime",
  "ResponseCode",
  "IsoCode",
  "ResponseMessage",
  "ErrorDescription",
  "RRN",
] as const;

function getAzulConfig() {
  const env = getServerEnv();

  return {
    paymentUrl: env.AZUL_PAYMENT_URL,
    merchantId: env.AZUL_MERCHANT_ID,
    merchantName: env.AZUL_MERCHANT_NAME,
    merchantType: env.AZUL_MERCHANT_TYPE ?? "ECommerce",
    authKey: env.AZUL_AUTH_KEY,
    currencyCode: env.AZUL_CURRENCY_CODE ?? "USD",
  };
}

function assertAzulConfig() {
  const config = getAzulConfig();

  if (!config.paymentUrl || !config.merchantId || !config.merchantName || !config.authKey) {
    throw new ServiceError(
      "BILLING_NOT_CONFIGURED",
      503,
      "La facturación con AZUL todavía no está configurada en este entorno.",
    );
  }

  return {
    paymentUrl: config.paymentUrl,
    merchantId: config.merchantId,
    merchantName: config.merchantName,
    merchantType: config.merchantType,
    authKey: config.authKey,
    currencyCode: config.currencyCode,
  };
}

function buildAzulHash(values: string[], authKey: string) {
  const payload = `${values.join("")}${authKey}`;

  return createHmac("sha512", authKey)
    .update(Buffer.from(payload, "utf16le"))
    .digest("hex");
}

export function formatAzulAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ServiceError("BILLING_AMOUNT_INVALID", 400, "El monto del checkout no es válido.");
  }

  return String(amountCents);
}

export function buildAzulCheckoutFields(input: CreateBillingCheckoutInput): Record<string, string> {
  const config = assertAzulConfig();
  const fieldsWithoutHash = {
    MerchantId: config.merchantId,
    MerchantName: config.merchantName,
    MerchantType: config.merchantType,
    CurrencyCode: config.currencyCode,
    OrderNumber: input.externalOrderId,
    Amount: formatAzulAmount(input.amountCents),
    ITBIS: "0",
    ApprovedUrl: input.approvedUrl,
    DeclinedUrl: input.declinedUrl,
    CancelUrl: input.cancelUrl,
  } satisfies Omit<AzulCheckoutFields, "AuthHash">;

  const authHash = buildAzulHash(
    azulCheckoutHashFields.map((field) => fieldsWithoutHash[field]),
    config.authKey,
  );

  return {
    ...fieldsWithoutHash,
    AuthHash: authHash,
  };
}

export function isAzulBillingConfigured() {
  const config = getAzulConfig();

  return Boolean(config.paymentUrl && config.merchantId && config.merchantName && config.authKey);
}

export function verifyAzulResponseHash(params: Record<string, string | undefined>) {
  const config = assertAzulConfig();
  const providedHash = params.AuthHash;

  if (!providedHash) {
    return false;
  }

  const expectedHash = buildAzulHash(
    azulResponseHashFields.map((field) => params[field] ?? ""),
    config.authKey,
  );

  return providedHash.toLowerCase() === expectedHash.toLowerCase();
}

export function isAzulApprovedResponse(params: Record<string, string | undefined>) {
  const isoCode = params.IsoCode?.trim();
  const responseCode = params.ResponseCode?.trim();
  const responseMessage = params.ResponseMessage?.trim().toUpperCase();

  return isoCode === "00" || responseCode === "00" || responseMessage === "APROBADA";
}

export function createAzulBillingProvider(): BillingProvider {
  return {
    provider: "AZUL",
    isConfigured: isAzulBillingConfigured,
    createCheckoutSession(input) {
      const config = assertAzulConfig();

      return {
        provider: "AZUL",
        mode: "form_post",
        method: "POST",
        url: config.paymentUrl,
        fields: buildAzulCheckoutFields(input),
        externalOrderId: input.externalOrderId,
        externalPriceCode: input.externalPriceCode,
      };
    },
  };
}
