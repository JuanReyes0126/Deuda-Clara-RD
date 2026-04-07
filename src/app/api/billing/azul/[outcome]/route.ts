import { NextRequest, NextResponse } from "next/server";

import { handleAzulPaymentReturn } from "@/server/billing/billing-service";
import { logServerError } from "@/server/observability/logger";

export const runtime = "nodejs";

type AzulRouteContext = {
  params: Promise<{
    outcome: string;
  }>;
};

function normalizeOutcome(outcome: string) {
  if (outcome === "approved" || outcome === "declined" || outcome === "cancelled") {
    return outcome;
  }

  return null;
}

async function getCallbackParams(request: NextRequest) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.searchParams);

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        if (typeof value === "string") {
          params.set(key, value);
        }
      });
    }
  }

  return params;
}

function buildRedirect(request: NextRequest, checkout: string) {
  return NextResponse.redirect(new URL(`/planes?checkout=${checkout}&provider=azul`, request.url));
}

async function handleAzulRoute(request: NextRequest, context: AzulRouteContext) {
  const { outcome: outcomeParam } = await context.params;
  const outcome = normalizeOutcome(outcomeParam);

  if (!outcome) {
    return buildRedirect(request, "error");
  }

  try {
    const params = await getCallbackParams(request);
    const result = await handleAzulPaymentReturn(outcome, params);

    return buildRedirect(request, result.checkout);
  } catch (error) {
    logServerError("AZUL billing return failed", { error, outcome });

    return buildRedirect(request, "error");
  }
}

export async function GET(request: NextRequest, context: AzulRouteContext) {
  return handleAzulRoute(request, context);
}

export async function POST(request: NextRequest, context: AzulRouteContext) {
  return handleAzulRoute(request, context);
}
