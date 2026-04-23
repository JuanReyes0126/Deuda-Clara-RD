import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";

type VisionDebtExtraction = {
  name: string | null;
  creditorName: string | null;
  currentBalance: number | null;
  minimumPayment: number | null;
  paymentAmount: number | null;
  interestRate: number | null;
  interestRateType: "ANNUAL" | "MONTHLY" | null;
  productType: "CREDIT_CARD" | "LOAN" | "INFORMAL" | "UNKNOWN";
  currency: "DOP" | "USD" | null;
  dueDateText: string | null;
  detectedAction: "payment" | "statement" | "unknown";
  confidence: "low" | "medium" | "high";
};

type VisionExtractionResult = {
  debts: VisionDebtExtraction[];
  summary: string;
  missingFields: string[];
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const maxImageDataUrlLength = 7_000_000;
const imageDataUrlPattern = /^data:image\/(png|jpeg|jpg|webp);base64,/i;

function extractOutputText(payload: OpenAiResponsePayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)?.text ??
    null
  );
}

function parseVisionJson(text: string): VisionExtractionResult {
  const trimmedText = text.trim();
  const jsonText = trimmedText.startsWith("```")
    ? trimmedText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
    : trimmedText;
  const parsed = JSON.parse(jsonText) as Partial<VisionExtractionResult>;

  return {
    debts: Array.isArray(parsed.debts) ? parsed.debts.slice(0, 5) : [],
    summary:
      typeof parsed.summary === "string"
        ? parsed.summary
        : "Clara pudo leer la imagen, pero necesita confirmar los datos.",
    missingFields: Array.isArray(parsed.missingFields)
      ? parsed.missingFields.filter((field): field is string => typeof field === "string")
      : [],
  };
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);

    const session = await getCurrentSession();

    if (!session) {
      return apiBadRequest("No autenticado.", 401);
    }

    const { imageDataUrl, prompt } = (await request.json()) as {
      imageDataUrl?: string;
      prompt?: string;
    };

    if (!imageDataUrl || !imageDataUrlPattern.test(imageDataUrl)) {
      return apiBadRequest("Sube una imagen PNG, JPG o WEBP válida.");
    }

    if (imageDataUrl.length > maxImageDataUrlLength) {
      return apiBadRequest(
        "La imagen es demasiado grande. Intenta con una captura más recortada.",
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini";

    if (!apiKey) {
      return apiBadRequest(
        "La lectura automática de imágenes todavía no está activada. Configura OPENAI_API_KEY en Vercel para usar visión.",
        503,
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Extrae datos financieros de esta imagen para una app de deudas personales en República Dominicana.

Devuelve solamente JSON válido con esta forma:
{
  "debts": [
    {
      "name": "nombre corto de la deuda o tarjeta",
      "creditorName": "banco, cooperativa o institución",
      "currentBalance": número o null,
      "minimumPayment": número o null,
      "paymentAmount": número o null,
      "interestRate": número o null,
      "interestRateType": "ANNUAL", "MONTHLY" o null,
      "productType": "CREDIT_CARD", "LOAN", "INFORMAL" o "UNKNOWN",
      "currency": "DOP", "USD" o null,
      "dueDateText": "fecha visible o null",
      "detectedAction": "payment", "statement" o "unknown",
      "confidence": "low", "medium" o "high"
    }
  ],
  "summary": "resumen corto en español",
  "missingFields": ["campos que no se ven claros"]
}

Si la imagen muestra varios pagos realizados, devuelve un item por cada pago y usa paymentAmount.
Si la imagen muestra estados de cuenta, usa currentBalance y minimumPayment.
Si aparece tasa de interés, extrae interestRate e interestRateType.
No inventes datos. Si un monto no está claro, usa null. ${
                  prompt ? `Contexto del usuario: ${prompt}` : ""
                }`,
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
              },
            ],
          },
        ],
      }),
    });
    const payload = (await response.json()) as OpenAiResponsePayload;

    if (!response.ok) {
      return apiBadRequest(
        payload.error?.message ??
          "No pudimos leer la imagen ahora mismo. Inténtalo de nuevo.",
        response.status,
      );
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      return apiBadRequest("No pudimos extraer texto útil de la imagen.");
    }

    return NextResponse.json({
      ok: true,
      extraction: parseVisionJson(outputText),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return apiBadRequest(
        "La imagen se leyó, pero la respuesta no vino en un formato claro. Intenta con una captura más nítida.",
      );
    }

    return handleApiError(
      error,
      "No pudimos analizar la imagen. Inténtalo de nuevo.",
    );
  }
}
