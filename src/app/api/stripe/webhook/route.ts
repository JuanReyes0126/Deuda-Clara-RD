import { NextRequest, NextResponse } from "next/server";

import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { handleStripeWebhook } from "@/server/billing/billing-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return apiBadRequest("Firma de Stripe ausente.");
    }

    const rawBody = await request.text();
    const eventType = await handleStripeWebhook(rawBody, signature);

    return NextResponse.json({ received: true, eventType });
  } catch (error) {
    return handleApiError(error, "No se pudo procesar el webhook.");
  }
}
