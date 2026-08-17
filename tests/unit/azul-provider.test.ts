import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAzulCheckoutFields,
  formatAzulAmount,
} from "@/server/billing/providers/azul-provider";

describe("azul-provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("formatea montos para AZUL sin punto ni coma", () => {
    expect(formatAzulAmount(500)).toBe("500");
    expect(formatAzulAmount(9900)).toBe("9900");
  });

  it("genera campos firmados para Payment Page", () => {
    vi.stubEnv("AZUL_PAYMENT_URL", "https://pagos.azul.test/PaymentPage");
    vi.stubEnv("AZUL_MERCHANT_ID", "390000000000001");
    vi.stubEnv("AZUL_MERCHANT_NAME", "Deuda Clara RD");
    vi.stubEnv("AZUL_MERCHANT_TYPE", "ECommerce");
    vi.stubEnv("AZUL_AUTH_KEY", "azul-auth-key");
    vi.stubEnv("AZUL_CURRENCY_CODE", "USD");

    const fields = buildAzulCheckoutFields({
      userId: "user-1",
      email: "cliente@example.com",
      fullName: "Cliente Demo",
      membershipTier: "NORMAL",
      billingInterval: "MONTHLY",
      sourceContext: "planes",
      amountCents: 500,
      currencyCode: "USD",
      externalPriceCode: "azul_normal_monthly_usd",
      externalOrderId: "DCORDER1",
      approvedUrl: "https://app.test/api/billing/azul/approved?orderNumber=DCORDER1",
      declinedUrl: "https://app.test/api/billing/azul/declined?orderNumber=DCORDER1",
      cancelUrl: "https://app.test/api/billing/azul/cancelled?orderNumber=DCORDER1",
    });

    expect(fields.MerchantId).toBe("390000000000001");
    expect(fields.CurrencyCode).toBe("USD");
    expect(fields.Amount).toBe("500");
    expect(fields.AuthHash).toHaveLength(128);
  });
});
