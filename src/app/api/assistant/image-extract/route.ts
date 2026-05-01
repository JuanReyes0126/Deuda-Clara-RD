import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { apiBadRequest, handleApiError } from "@/server/api/api-response";
import { logServerError } from "@/server/observability/logger";

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
const visionProviderTimeoutMs = 12_000;

function buildVisionPrompt(prompt?: string) {
  return `Extrae datos financieros de esta imagen para una app de deudas personales en República Dominicana.

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
Si es una tarjeta de crédito y no ves la tasa, no inventes la tasa: marca interestRate como null para que Clara pida confirmación.
No inventes datos. Si un monto no está claro, usa null. ${
    prompt ? `Contexto del usuario: ${prompt}` : ""
  }`;
}

function parseImageDataUrl(imageDataUrl: string) {
  const match = imageDataUrl.match(
    /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i,
  );

  if (!match) {
    return null;
  }

  const mediaType = match[1];
  const base64 = match[2];

  if (!mediaType || !base64) {
    return null;
  }

  return {
    mediaType: mediaType.toLowerCase().replace("image/jpg", "image/jpeg"),
    base64,
  };
}

function extractOutputText(payload: OpenAiResponsePayload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text" && content.text)
      ?.text ?? null
  );
}

function parseVisionJson(text: string): VisionExtractionResult {
  const trimmedText = text.trim();
  const jsonText = trimmedText.startsWith("```")
    ? trimmedText
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim()
    : trimmedText;
  const parsed = JSON.parse(jsonText) as Partial<VisionExtractionResult>;

  return {
    debts: Array.isArray(parsed.debts) ? parsed.debts.slice(0, 5) : [],
    summary:
      typeof parsed.summary === "string"
        ? parsed.summary
        : "Clara pudo leer la imagen, pero necesita confirmar los datos.",
    missingFields: Array.isArray(parsed.missingFields)
      ? parsed.missingFields.filter(
          (field): field is string => typeof field === "string",
        )
      : [],
  };
}

function getFriendlyVisionSetupError(message: string | null) {
  if (!message) {
    return null;
  }

  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("credit card") ||
    normalizedMessage.includes("card on file") ||
    normalizedMessage.includes("add a card")
  ) {
    return "Clara ya está conectada a visión, pero Vercel está bloqueando la lectura porque la cuenta necesita una tarjeta válida para usar AI Gateway. Agrega una tarjeta en Vercel o configura OPENAI_API_KEY para activar lectura de imágenes.";
  }

  if (
    normalizedMessage.includes("ai gateway") ||
    normalizedMessage.includes("gateway")
  ) {
    return "Clara intentó usar Vercel AI Gateway, pero el servicio no está listo para esta cuenta. Activa AI Gateway en Vercel o configura OPENAI_API_KEY para leer imágenes.";
  }

  return message;
}

async function readImageWithOpenAi({
  imageDataUrl,
  prompt,
}: {
  imageDataUrl: string;
  prompt: string | undefined;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini";
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), visionProviderTimeoutMs);
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
              text: buildVisionPrompt(prompt),
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
    }),
    signal: abortController.signal,
  }).finally(() => clearTimeout(timeoutId));
  const payload = (await response.json()) as OpenAiResponsePayload;

  if (!response.ok) {
    throw new Error(
      payload.error?.message ??
        "No pudimos leer la imagen ahora mismo. Inténtalo de nuevo.",
    );
  }

  return extractOutputText(payload);
}

async function readImageWithGateway({
  imageDataUrl,
  prompt,
}: {
  imageDataUrl: string;
  prompt: string | undefined;
}) {
  if (
    !process.env.AI_GATEWAY_API_KEY &&
    !process.env.VERCEL &&
    !process.env.VERCEL_OIDC_TOKEN
  ) {
    return null;
  }

  const parsedImage = parseImageDataUrl(imageDataUrl);

  if (!parsedImage) {
    return null;
  }

  const gatewayModel =
    process.env.AI_GATEWAY_VISION_MODEL ??
    `openai/${process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini"}`;
  const result = await Promise.race([
    generateText({
      model: gatewayModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildVisionPrompt(prompt),
            },
            {
              type: "image",
              image: parsedImage.base64,
              mediaType: parsedImage.mediaType,
            },
          ],
        },
      ],
      maxRetries: 1,
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI Gateway request timed out.")), visionProviderTimeoutMs);
    }),
  ]);

  return result.text;
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

    let outputText: string | null = null;
    let gatewayErrorMessage: string | null = null;

    try {
      outputText = await readImageWithOpenAi({ imageDataUrl, prompt });
    } catch (error) {
      logServerError("OpenAI vision request failed", { error });
    }

    if (!outputText) {
      try {
        outputText = await readImageWithGateway({ imageDataUrl, prompt });
      } catch (error) {
        const rawMessage =
          error instanceof Error ? error.message : "AI Gateway no respondió.";
        gatewayErrorMessage = getFriendlyVisionSetupError(rawMessage);
      }
    }

    if (!outputText) {
      return apiBadRequest(
        gatewayErrorMessage ??
          "La lectura automática de imágenes todavía no está activada. Configura OPENAI_API_KEY o activa Vercel AI Gateway para usar visión.",
        503,
      );
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
