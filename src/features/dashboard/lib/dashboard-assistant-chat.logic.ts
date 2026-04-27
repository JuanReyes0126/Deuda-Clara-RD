import type { DragEvent } from "react";

import type { DashboardDto, DebtItemDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatRelativeDistance } from "@/lib/utils/date";

import {
  dominicanCreditCardRateReferences,
  genericCreditCardRateReference,
} from "./dashboard-assistant-chat.constants";
import type {
  AssistantReply,
  ChatMessage,
  ClaraChatPaymentMemory,
  PaymentDraft,
  VisionDebtExtraction,
  VisionExtractionResult,
} from "./dashboard-assistant-chat.types";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function truncateClaraSentence(text: string, max = 220) {
  const trimmed = text.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function getCreditCardRateReference(creditorName: string | null) {
  const normalizedCreditor = normalizeText(creditorName ?? "");

  return (
    dominicanCreditCardRateReferences.find((reference) =>
      reference.aliases.some((alias) =>
        normalizedCreditor.includes(normalizeText(alias)),
      ),
    ) ?? genericCreditCardRateReference
  );
}

function buildPaymentHref(debt: DebtItemDto | null, amount?: number | null) {
  const params = new URLSearchParams({ from: "clara-chat" });

  if (debt?.id) {
    params.set("debtId", debt.id);
  }

  if (amount && Number.isFinite(amount) && amount > 0) {
    params.set("amount", String(Number(amount.toFixed(2))));
  }

  return `/pagos?${params.toString()}`;
}

function getAssistantDebts(data: DashboardDto) {
  const debtsById = new Map<string, DebtItemDto>();

  for (const debt of [
    ...data.activeDebts,
    ...(data.urgentDebt ? [data.urgentDebt] : []),
    ...data.dueSoonDebts,
  ]) {
    debtsById.set(debt.id, debt);
  }

  return Array.from(debtsById.values());
}

function getPriorityDebt(data: DashboardDto) {
  const priorityId =
    data.summary.recommendedDebtId ??
    data.urgentDebt?.id ??
    data.dueSoonDebts[0]?.id ??
    null;
  const debts = getAssistantDebts(data);

  if (!priorityId) {
    return data.urgentDebt ?? data.dueSoonDebts[0] ?? debts[0] ?? null;
  }

  return (
    debts.find((debt) => debt.id === priorityId) ??
    data.urgentDebt ??
    data.dueSoonDebts[0] ??
    null
  );
}

function getSuggestedPaymentAmount(debt: DebtItemDto | null) {
  if (!debt) {
    return null;
  }

  if (debt.minimumPayment > 0) {
    return debt.minimumPayment;
  }

  return debt.effectiveBalance > 0 ? debt.effectiveBalance : null;
}

function getDebtName(data: DashboardDto, priorityDebt: DebtItemDto | null) {
  return (
    priorityDebt?.name ??
    data.summary.recommendedDebtName ??
    data.recommendedOrder[0]?.name ??
    "tu deuda prioritaria"
  );
}

function createPaymentAction(debt: DebtItemDto | null) {
  const amount = getSuggestedPaymentAmount(debt);

  return {
    label: amount ? "Registrar pago sugerido" : "Registrar pago",
    href: buildPaymentHref(debt, amount),
    variant: "primary" as const,
  };
}

function parseMoneyNumber(rawValue: string) {
  const compactValue = rawValue.replace(/\s/g, "");

  if (compactValue.includes(".") && compactValue.includes(",")) {
    return Number(compactValue.replace(/,/g, ""));
  }

  if (compactValue.includes(",")) {
    const parts = compactValue.split(",");
    const lastPart = parts.at(-1) ?? "";

    if (lastPart.length === 3 && parts.length > 1) {
      return Number(parts.join(""));
    }

    return Number(compactValue.replace(",", "."));
  }

  return Number(compactValue.replace(/,/g, ""));
}

function parsePaymentAmount(message: string) {
  const numericMilMatch = normalizeText(message).match(
    /\b(\d+(?:[.,]\d+)?)\s*(mil|k)\b/,
  );

  if (numericMilMatch?.[1]) {
    const parsedAmount = parseMoneyNumber(numericMilMatch[1]) * 1000;
    return Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : null;
  }

  const currencyMatch = message.match(
    /(?:rd\$|us\$|\$|dop|usd|pesos?|d[oó]lares?)\s*([0-9][0-9.,]*)|([0-9][0-9.,]*)\s*(?:rd\$|us\$|\$|dop|usd|pesos?|d[oó]lares?)/i,
  );
  const currencyValue = currencyMatch?.[1] ?? currencyMatch?.[2];

  if (currencyValue) {
    const parsedAmount = parseMoneyNumber(currencyValue);
    return Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : null;
  }

  const paymentVerbMatch = normalizeText(message).match(
    /(?:pague|abone|abona|pagaron|registre|registrar|anota|guarda)\s+(?:rd\$|us\$|\$)?\s*([0-9][0-9.,]*)/,
  );

  if (paymentVerbMatch?.[1]) {
    const parsedAmount = parseMoneyNumber(paymentVerbMatch[1]);
    return Number.isFinite(parsedAmount) && parsedAmount > 0
      ? parsedAmount
      : null;
  }

  const fallbackMatch = normalizeText(message).match(/\b([0-9]{3,}[0-9.,]*)\b/);

  if (!fallbackMatch?.[1]) {
    return null;
  }

  const parsedAmount = parseMoneyNumber(fallbackMatch[1]);

  return Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;
}

function getDebtAliasScore(debt: DebtItemDto, normalizedMessage: string) {
  let score = 0;
  const normalizedName = normalizeText(debt.name);
  const normalizedCreditor = normalizeText(debt.creditorName);
  const nameTokens = normalizedName
    .split(/\s+/)
    .filter((token) => token.length >= 4);

  if (normalizedMessage.includes(normalizedName)) {
    score += 8;
  }

  if (normalizedCreditor && normalizedMessage.includes(normalizedCreditor)) {
    score += 5;
  }

  score += nameTokens.filter((token) => normalizedMessage.includes(token)).length;

  if (
    /prestamo|cuota|financiamiento/.test(normalizedMessage) &&
    debt.type.includes("LOAN")
  ) {
    score += 2;
  }

  if (/tarjeta|card|credito/.test(normalizedMessage) && debt.type === "CREDIT_CARD") {
    score += 2;
  }

  if (/informal|familiar|amigo/.test(normalizedMessage) && debt.type === "INFORMAL") {
    score += 2;
  }

  return score;
}

function findMentionedDebt(data: DashboardDto, message: string) {
  const debts = getAssistantDebts(data);
  const normalizedMessage = normalizeText(message);
  const priorityDebt = getPriorityDebt(data);
  const scoredDebts = debts
    .map((debt) => ({
      debt,
      score:
        getDebtAliasScore(debt, normalizedMessage) +
        (debt.id === priorityDebt?.id ? 1.5 : 0),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredDebts[0];

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.debt;
  }

  return getPriorityDebt(data);
}

function findMentionedDebtForClause(data: DashboardDto, segment: string) {
  const debts = getAssistantDebts(data);
  const normalizedMessage = normalizeText(segment);
  const scoredDebts = debts
    .map((debt) => ({
      debt,
      score: getDebtAliasScore(debt, normalizedMessage),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredDebts[0];

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.debt;
  }

  if (debts.length === 1) {
    return debts[0] ?? null;
  }

  return null;
}

function isPaymentRegistrationIntent(message: string) {
  return /pague|pago realizado|ya pague|lo pague|la pague|abone|abonado|registralo|registrarlo|registrame|registrarlos|registralos|anota|anotame|guarda|guardalo|marcalo|marcarlo|registra\s+(los|las|el|la)\s+pagos?|registra\s+pago|haz(el)?\s+registro|apunta(r)?\s+(el|los)\s+pago/.test(
    normalizeText(message),
  );
}

function isExplicitBulkRegisterIntent(message: string) {
  const t = normalizeText(message);

  return (
    /\bregistral(o|a)(s)?\b/.test(t) ||
    /\bregistrame(los|las)?\b/.test(t) ||
    /\bregistra(\s+los|\s+las|\s+el|\s+la)?\s+pagos?\b/.test(t) ||
    /\bregistra\s+todo\b/.test(t) ||
    /\bguarda(los|lo)?(\s+eso|\s+esto)?\b/.test(t) ||
    /\banota(los|lo)?(\s+eso|\s+esto)?\b/.test(t) ||
    /\bconfirma\s+y\s+registra\b/.test(t) ||
    /\bquiero\s+que\s+(los\s+)?registres\b/.test(t) ||
    /\blo\s+que\s+te\s+dije\b/.test(t)
  );
}

function stripTrailingRegisterInstructions(text: string) {
  return text
    .replace(
      /\s*,?\s*(registr\w*|guard\w*|anot\w*|confirma\w*|procesa\w*)\s*(todo|eso|los|las|me)?\s*\.?\s*$/i,
      "",
    )
    .trim();
}

function splitPaymentClauses(text: string) {
  const cleaned = stripTrailingRegisterInstructions(text);
  const byConjunction = cleaned
    .split(/\s+y\s+|\s+tambien\s+|\s+ademas\s+|;\s*|\n+/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (byConjunction.length > 1) {
    return byConjunction;
  }

  return [cleaned];
}

function clauseLooksLikePayment(segment: string) {
  return (
    isPaymentRegistrationIntent(segment) ||
    parsePaymentAmount(segment) !== null ||
    /\b(rd\$|us\$)\s*[0-9]/.test(normalizeText(segment))
  );
}

function dedupePaymentDrafts(drafts: PaymentDraft[]) {
  const seen = new Set<string>();

  return drafts.filter((draft) => {
    const key = `${draft.debtId}:${draft.amount.toFixed(2)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function tryBuildPaymentDraftFromClause(
  data: DashboardDto,
  segment: string,
  fullSourcePrompt: string,
) {
  if (!clauseLooksLikePayment(segment)) {
    return null;
  }

  const debt = findMentionedDebtForClause(data, segment);
  const parsedAmount = parsePaymentAmount(segment);

  if (!debt) {
    return null;
  }

  const suggestedAmount = getSuggestedPaymentAmount(debt);
  const amount = parsedAmount ?? suggestedAmount;

  if (!amount || amount <= 0) {
    return null;
  }

  return {
    debtId: debt.id,
    debtName: debt.name,
    creditorName: debt.creditorName,
    amount,
    currency: debt.currency,
    sourcePrompt: fullSourcePrompt.slice(0, 400),
    usedSuggestedAmount: !parsedAmount,
  } satisfies PaymentDraft;
}

function extractMultiPaymentDrafts(data: DashboardDto, message: string) {
  const cleaned = stripTrailingRegisterInstructions(message);
  const clauses = splitPaymentClauses(cleaned);

  if (clauses.length <= 1) {
    const single = buildPaymentDraft(data, message);

    return single ? [single] : [];
  }

  const parentHasIntent =
    isPaymentRegistrationIntent(message) || parsePaymentAmount(message) !== null;

  if (!parentHasIntent) {
    return [];
  }

  const drafts = clauses
    .map((clause) => tryBuildPaymentDraftFromClause(data, clause, message))
    .filter((draft): draft is PaymentDraft => Boolean(draft));

  return dedupePaymentDrafts(drafts);
}

function extractPaymentDraftsWithFollowUp(
  data: DashboardDto,
  message: string,
  priorUserMessages: string[],
) {
  const fromCurrent = extractMultiPaymentDrafts(data, message);

  if (fromCurrent.length > 0) {
    return fromCurrent;
  }

  if (!isExplicitBulkRegisterIntent(message)) {
    return [];
  }

  const newestFirst = [...priorUserMessages].reverse();

  for (const previous of newestFirst) {
    const fromPrevious = extractMultiPaymentDrafts(data, previous);

    if (fromPrevious.length > 0) {
      return fromPrevious;
    }
  }

  const combined = priorUserMessages.join(" ").trim();

  if (combined) {
    return extractMultiPaymentDrafts(data, combined);
  }

  return [];
}

function buildPaymentDraft(data: DashboardDto, message: string) {
  if (!isPaymentRegistrationIntent(message)) {
    return null;
  }

  const debt = findMentionedDebt(data, message);

  if (!debt) {
    return null;
  }

  const parsedAmount = parsePaymentAmount(message);
  const suggestedAmount = getSuggestedPaymentAmount(debt);
  const amount = parsedAmount ?? suggestedAmount;

  if (!amount || amount <= 0) {
    return null;
  }

  return {
    debtId: debt.id,
    debtName: debt.name,
    creditorName: debt.creditorName,
    amount,
    currency: debt.currency,
    sourcePrompt: message,
    usedSuggestedAmount: !parsedAmount,
  } satisfies PaymentDraft;
}

function findImageMatchedDebt(data: DashboardDto, extraction: VisionDebtExtraction) {
  const debts = getAssistantDebts(data);
  const normalizedMessage = normalizeText(
    `${extraction.name ?? ""} ${extraction.creditorName ?? ""}`,
  );
  const scoredDebts = debts
    .map((debt) => ({
      debt,
      score: getDebtAliasScore(debt, normalizedMessage),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredDebts[0];

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.debt;
  }

  return debts.length === 1 ? debts[0] : null;
}

function buildImagePaymentDraft({
  data,
  extraction,
  fileName,
  summary,
}: {
  data: DashboardDto;
  extraction: VisionDebtExtraction;
  fileName: string;
  summary: string;
}): PaymentDraft | null {
  const matchedDebt = findImageMatchedDebt(data, extraction);
  const amount = extraction.paymentAmount ?? extraction.minimumPayment;

  if (!matchedDebt || !amount || amount <= 0) {
    return null;
  }

  return {
    debtId: matchedDebt.id,
    debtName: matchedDebt.name,
    creditorName: matchedDebt.creditorName,
    amount,
    currency: matchedDebt.currency,
    sourcePrompt: `Imagen ${fileName}: ${summary}`,
    usedSuggestedAmount: false,
  } satisfies PaymentDraft;
}

export function buildImageAssistantReply(
  data: DashboardDto,
  extraction: VisionExtractionResult,
  fileName: string,
): AssistantReply {
  const detectedDebts = extraction.debts.slice(0, 5);
  const primaryDebt = detectedDebts[0] ?? null;

  if (!primaryDebt) {
    return {
      title: "Recibí la imagen, pero no detecté una deuda clara.",
      body:
        "Intenta con una captura más recortada donde se vea saldo, pago mínimo, institución y fecha.",
      steps: [
        "Recorta la imagen alrededor del estado de cuenta.",
        "Evita capturas borrosas o muy oscuras.",
        "Si quieres, escribe el monto y Clara prepara el pago.",
      ],
      actions: [],
      badgeLabel: "Imagen recibida",
      badgeVariant: "warning",
    };
  }

  const paymentDrafts = detectedDebts
    .map((debtExtraction) =>
      buildImagePaymentDraft({
        data,
        extraction: debtExtraction,
        fileName,
        summary: extraction.summary,
      }),
    )
    .filter((draft): draft is PaymentDraft => Boolean(draft));
  const matchedDebt = findImageMatchedDebt(data, primaryDebt);
  const currency = primaryDebt.currency ?? matchedDebt?.currency ?? "DOP";
  const balanceLabel =
    primaryDebt.currentBalance !== null
      ? formatCurrency(primaryDebt.currentBalance, currency)
      : "No visible";
  const minimumPaymentLabel =
    primaryDebt.minimumPayment !== null
      ? formatCurrency(primaryDebt.minimumPayment, currency)
      : "No visible";
  const detectedPaymentCount = detectedDebts.filter(
    (debt) => debt.paymentAmount !== null,
  ).length;
  const isCreditCardLike =
    primaryDebt.productType === "CREDIT_CARD" ||
    /tarjeta|credito|crédito|card/.test(
      normalizeText(`${primaryDebt.name ?? ""} ${primaryDebt.creditorName ?? ""}`),
    );
  const isRegistrationCandidate =
    paymentDrafts.length === 0 &&
    (primaryDebt.currentBalance !== null ||
      primaryDebt.minimumPayment !== null ||
      Boolean(primaryDebt.productType && primaryDebt.productType !== "UNKNOWN"));

  if (isRegistrationCandidate) {
    const rateReference = getCreditCardRateReference(primaryDebt.creditorName);
    const extractedRateLabel = primaryDebt.interestRate
      ? `${primaryDebt.interestRate}% ${
          primaryDebt.interestRateType === "MONTHLY" ? "mensual" : "anual"
        }`
      : null;

    return {
      title: isCreditCardLike
        ? "Puedo ayudarte a registrar esta tarjeta, pero confirma la tasa."
        : "Puedo ayudarte a registrar esta deuda, pero necesito la tasa.",
      body: isCreditCardLike
        ? `Para tarjetas en RD uso referencias por banco solo como ayuda. No guardo una tasa estimada sin que el usuario la confirme.`
        : "Para que el plan sea realista, Clara necesita la tasa de interés y si esa tasa es anual o mensual.",
      steps: [
        `Institución: ${primaryDebt.creditorName ?? "No visible"}.`,
        `Saldo: ${balanceLabel}.`,
        `Pago mínimo: ${minimumPaymentLabel}.`,
        extractedRateLabel
          ? `Tasa detectada: ${extractedRateLabel}.`
          : isCreditCardLike
            ? `Referencia ${rateReference.label}: ${rateReference.annualRange} (aprox. ${rateReference.monthlyReferencePct}% mensual). Confírmala en tu contrato o estado.`
            : "Falta tasa de interés: escríbela como anual o mensual antes de guardar.",
      ],
      actions: [
        { label: "Registrar deuda", href: "/deudas", variant: "primary" },
        { label: "Preguntarle a Clara", href: "/dashboard", variant: "secondary" },
      ],
      badgeLabel: isCreditCardLike ? "Tasa por confirmar" : "Falta tasa",
      badgeVariant: "warning",
    };
  }

  const reply: AssistantReply = {
    title:
      paymentDrafts.length > 1
        ? `Detecté ${paymentDrafts.length} pagos listos para registrar.`
        : `Leí la imagen: ${primaryDebt.name ?? primaryDebt.creditorName ?? "deuda detectada"}.`,
    body:
      paymentDrafts.length > 1
        ? "Clara encontró varios movimientos y los preparó como multi registro. Revisa la lista antes de confirmar todos."
        : paymentDrafts.length === 1
          ? "Encontré un pago y lo dejé listo para registrar en una deuda existente. Revísalo antes de confirmar."
        : extraction.summary,
    steps:
      paymentDrafts.length > 1
        ? paymentDrafts.map(
            (draft) =>
              `${draft.debtName}: ${formatCurrency(draft.amount, draft.currency)}.`,
          )
        : [
            `Institución: ${primaryDebt.creditorName ?? "No visible"}.`,
            `Saldo: ${balanceLabel}.`,
            detectedPaymentCount > 0
              ? `Pago detectado: ${formatCurrency(primaryDebt.paymentAmount ?? 0, currency)}.`
              : `Pago mínimo: ${minimumPaymentLabel}.`,
            primaryDebt.dueDateText
              ? `Fecha visible: ${primaryDebt.dueDateText}.`
              : "Fecha: no visible.",
          ],
    actions: paymentDrafts.length > 0
      ? []
      : [
          { label: "Revisar deudas", href: "/deudas", variant: "primary" },
          { label: "Registrar pago manual", href: "/pagos", variant: "secondary" },
        ],
    badgeLabel:
      primaryDebt.confidence === "high"
        ? "Lectura alta"
        : primaryDebt.confidence === "medium"
          ? "Revisar datos"
          : "Baja confianza",
    badgeVariant:
      primaryDebt.confidence === "high"
        ? "success"
        : primaryDebt.confidence === "medium"
          ? "warning"
          : "danger",
  };

  if (paymentDrafts.length === 1 && paymentDrafts[0]) {
    reply.paymentDraft = paymentDrafts[0];
  }

  if (paymentDrafts.length > 1) {
    reply.paymentDrafts = paymentDrafts;
  }

  return reply;
}

export function getImageTransferFile(files: FileList | null) {
  return Array.from(files ?? []).find((file) => file.type.startsWith("image/")) ?? null;
}

export function hasImageTransfer(event: DragEvent<HTMLElement>) {
  const dt = event.dataTransfer;
  if (!dt) {
    return false;
  }

  const types = Array.from(dt.types ?? []);
  if (types.includes("Files")) {
    return true;
  }

  return Array.from(dt.items ?? []).some(
    (item) =>
      item.kind === "file" ||
      (typeof item.type === "string" && item.type.startsWith("image/")),
  );
}

function getCurrencyForDebtId(data: DashboardDto, debtId: string) {
  for (const debt of getAssistantDebts(data)) {
    if (debt.id === debtId) {
      return debt.currency;
    }
  }

  return "DOP" as const;
}

function isConversationMemoryIntent(message: string) {
  const text = normalizeText(message);

  return (
    /\bultimos?\s+pagos?\b/.test(text) ||
    /\bmemoria\b/.test(text) ||
    /\blo\s+que\s+llevamos\b/.test(text) ||
    /\blo\s+que\s+hablamos\b/.test(text) ||
    /\bresumen\s+de\s+pagos?\b/.test(text) ||
    /\bque\s+pague\b/.test(text) ||
    /\brecordar\s+pagos?\b/.test(text) ||
    /\bhistorial\s+de\s+esta\s+charla\b/.test(text) ||
    /\bcharla\s+y\s+cuenta\b/.test(text)
  );
}

function buildConversationMemoryReply(
  data: DashboardDto,
  paymentLog: ClaraChatPaymentMemory[],
  message: string,
): AssistantReply | null {
  if (!isConversationMemoryIntent(message)) {
    return null;
  }

  const chatLines =
    paymentLog.length === 0
      ? [
          "Todavía no confirmamos ningún pago desde este panel (cuando confirmes uno aquí, quedará en esta memoria).",
        ]
      : [...paymentLog]
          .reverse()
          .slice(0, 12)
          .map((entry) => {
            const when = formatDate(entry.recordedAt, "d MMM yyyy · HH:mm");
            return `${when} · ${entry.debtName} · ${formatCurrency(entry.amount, entry.currency)}`;
          });

  const appPayments = data.recentPayments.slice(0, 8);
  const appLines =
    appPayments.length === 0
      ? ["No hay pagos recientes en tu cuenta para listar."]
      : appPayments.map((payment) => {
          const currency = getCurrencyForDebtId(data, payment.debtId);
          const when = formatDate(payment.paidAt, "d MMM yyyy");
          const fromClara = payment.notes?.includes("Clara") ?? false;
          return `${when} · ${payment.debtName} · ${formatCurrency(payment.amount, currency)}${fromClara ? " · registrado vía Clara" : ""}`;
        });

  return {
    title: "Aquí está lo que llevamos: charla y cuenta",
    body:
      "Combino lo que confirmaste conmigo en esta ventana con los últimos pagos que ya están guardados en Deuda Clara. Así puedes retomar el hilo sin perder el contexto.",
    steps: [
      "Desde esta conversación (memoria local en tu navegador):",
      ...chatLines,
      "Últimos movimientos en tu cuenta:",
      ...appLines,
    ],
    actions: [{ label: "Ver todos los pagos", href: "/pagos", variant: "primary" }],
    badgeLabel: "Memoria",
    badgeVariant: "default",
  };
}

export function sanitizePersistedChatMessages(raw: unknown[]): ChatMessage[] {
  const out: ChatMessage[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;

    if (typeof row.id !== "string" || typeof row.content !== "string") {
      continue;
    }

    if (row.role !== "user" && row.role !== "assistant") {
      continue;
    }

    const message: ChatMessage = {
      id: row.id,
      role: row.role,
      content: row.content,
    };

    if (row.reply && typeof row.reply === "object") {
      message.reply = row.reply as AssistantReply;
    }

    out.push(message);
  }

  return out;
}

export function sanitizePaymentLog(raw: unknown): ClaraChatPaymentMemory[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const out: ClaraChatPaymentMemory[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;

    if (typeof row.id !== "string" || typeof row.recordedAt !== "string") {
      continue;
    }

    if (typeof row.debtName !== "string") {
      continue;
    }

    if (typeof row.amount !== "number" || !Number.isFinite(row.amount)) {
      continue;
    }

    const currency = row.currency === "USD" ? "USD" : "DOP";
    const source =
      row.source === "clara_chat_bulk" ? "clara_chat_bulk" : "clara_chat_single";

    out.push({
      id: row.id,
      recordedAt: row.recordedAt,
      debtName: row.debtName,
      amount: row.amount,
      currency,
      source,
    });
  }

  return out;
}

export function buildAssistantReply(
  data: DashboardDto,
  message: string,
  context: { paymentLog: ClaraChatPaymentMemory[]; priorUserMessages: string[] },
): AssistantReply {
  const text = normalizeText(message);
  const memoryReply = buildConversationMemoryReply(data, context.paymentLog, message);

  if (memoryReply) {
    return memoryReply;
  }
  const priorityDebt = getPriorityDebt(data);
  const priorityDebtName = getDebtName(data, priorityDebt);
  const suggestedAmount = getSuggestedPaymentAmount(priorityDebt);
  const hasDebts = data.summary.totalDebt > 0;
  const dueDate = priorityDebt?.nextDueDate
    ? formatRelativeDistance(priorityDebt.nextDueDate)
    : null;
  const debtCurrency = priorityDebt?.currency ?? "DOP";
  const suggestedAmountLabel = suggestedAmount
    ? formatCurrency(suggestedAmount, debtCurrency)
    : null;
  const isLateIntent = /atras|mora|vencid|tarde|urgente|bloque/.test(text);
  const isBudgetIntent =
    /no me alcanza|alcanz|dinero|cobro|sueldo|ingreso|gasto|presupuesto|quincena|nomina/.test(
      text,
    );
  const isInterestIntent = /interes|ahorr|caro|cost|bajar|reduc/.test(text);
  const isPaymentIntent =
    /pago|pagar|primero|rapido|rapido|prioridad|saldar|cuota/.test(text);
  const trimmedNorm = text.trim();
  const isSnapshotOverviewIntent =
    /\b(como\s+voy|donde\s+estoy|panorama|estado\s+general|mi\s+situacion)\b/.test(text) ||
    trimmedNorm === "resumen" ||
    /\b(dame\s+un\s+resumen|resumen\s+rapido)\b/.test(text);
  const isUpcomingEventsIntent =
    /\b(proximos?|proximo)\s+(venc|pagos?|fechas?|eventos?)\b/.test(text) ||
    /\b(que\s+viene|calendario|agenda)\b/.test(text) ||
    /\bvencimientos?\s+cercanos?\b/.test(text) ||
    /\bproximos?\s+dias?\b/.test(text) ||
    /\bcuando\s+vence\b/.test(text);
  const isMotivationIntent =
    /\b(animo|racha|constancia|motivacion|dale\s+que|sigue\s+asi|te\s+animo|me\s+animas)\b/.test(
      text,
    ) || /\bcomo\s+llev(o|amos)\b/.test(text);
  const isRiskHelpIntent =
    /\b(alertas?|riesgos?|algo\s+mal|preocupa|debo\s+preocupar)\b/.test(text);
  const isOptimizePlanIntent =
    /\b(optimiz|plan\s+recomend|comparar\s+planes|menos\s+meses|meses\s+menos|plan\s+premium)\b/.test(
      text,
    );
  const isSimulatorHelpIntent =
    /\b(simulador|simular|escenarios?|que\s+pasa\s+si|jugar\s+con\s+numeros)\b/.test(text);
  const isNotificationsIntent =
    /\b(notificaciones?|recordatorios?|avisos?\s+de|correo\s+de\s+recordatorio)\b/.test(text);
  const paymentDrafts = extractPaymentDraftsWithFollowUp(
    data,
    message,
    context.priorUserMessages,
  );
  const wantsPaymentRegistrationHelp =
    isPaymentRegistrationIntent(message) ||
    isExplicitBulkRegisterIntent(message) ||
    paymentDrafts.length > 0;

  if (!hasDebts) {
    return {
      title: "Primero carguemos una deuda para poder guiarte bien.",
      body: "Clara necesita al menos una deuda activa para decirte qué pagar primero y cuánto conviene mover.",
      steps: [
        "Registra la deuda con saldo, tasa y fecha de pago.",
        "Luego vuelve al dashboard y Clara te dará una prioridad clara.",
      ],
      actions: [
        { label: "Registrar deuda", href: "/deudas", variant: "primary" },
      ],
      badgeLabel: "Primer paso",
      badgeVariant: "default",
    };
  }

  if (wantsPaymentRegistrationHelp && paymentDrafts.length === 0) {
    return {
      title: "Puedo registrarlo por ti, pero necesito un poco más de detalle.",
      body:
        "Dime montos y a qué deuda va cada uno. En una sola línea puedes poner varios: “pagué RD$5,000 al Popular y RD$3,000 a la tarjeta BHD”. Luego di “regístralos” o pulsa confirmar. Si ya lo escribiste arriba, vuelve a pegar la misma línea.",
      steps: [
        "Incluye el monto pagado (o varios, separados con “y”).",
        "Menciona préstamo, tarjeta o banco en cada parte.",
        "Yo preparo el registro y tú solo confirmas en el botón.",
      ],
      actions: [
        { label: "Registrar manualmente", href: "/pagos", variant: "secondary" },
      ],
      badgeLabel: "Falta dato",
      badgeVariant: "warning",
    };
  }

  if (paymentDrafts.length > 1) {
    return {
      title: `Listo: ${paymentDrafts.length} pagos preparados para guardar.`,
      body:
        "Revisa cada monto y deuda. Si coincide con lo que pagaste, confirma el multi registro y Clara los deja en tu historial al instante.",
      steps: paymentDrafts.map((draft) => {
        const amountLabel = formatCurrency(draft.amount, draft.currency);

        return `${draft.debtName}: ${amountLabel}${draft.usedSuggestedAmount ? " (referencia sugerida)" : ""}.`;
      }),
      actions: [],
      paymentDrafts,
      badgeLabel: "Multi pago",
      badgeVariant: "success",
    };
  }

  if (paymentDrafts.length === 1) {
    const paymentDraft = paymentDrafts[0]!;
    const amountLabel = formatCurrency(paymentDraft.amount, paymentDraft.currency);

    return {
      title: `Listo, puedo registrar ${amountLabel} en ${paymentDraft.debtName}.`,
      body: paymentDraft.usedSuggestedAmount
        ? `No vi el monto exacto en tu mensaje, así que preparé el pago de referencia de ${amountLabel}. Confirma solo si ese fue el monto correcto.`
        : `Detecté el pago y lo dejé listo para guardar. Al confirmar, Clara actualiza tu historial y el saldo de esa deuda.`,
      steps: [
        `Deuda: ${paymentDraft.debtName}.`,
        `Monto: ${amountLabel}.`,
        "Fecha: hoy.",
      ],
      actions: [],
      paymentDraft,
      badgeLabel: "Pago listo",
      badgeVariant: "success",
    };
  }

  if (isNotificationsIntent) {
    return {
      title: "Tus avisos, a tu ritmo",
      body: "Puedes encender solo lo que te ayuda a actuar: vencimientos, mora próxima o un resumen mensual. Clara no necesita bombardearte para funcionar bien.",
      steps: [
        "Menos ruido suele significar más acción: elige pocos recordatorios útiles.",
        "Ajusta los días antes del vencimiento y la hora del correo para que coincida con cuando revisas finanzas.",
      ],
      actions: [
        { label: "Notificaciones", href: "/notificaciones", variant: "primary" },
        { label: "Configuración", href: "/configuracion", variant: "secondary" },
      ],
      badgeLabel: "Avisos",
      badgeVariant: "default",
    };
  }

  if (isSnapshotOverviewIntent) {
    const totalDebtLabel = formatCurrency(data.summary.totalDebt);
    const minLabel = formatCurrency(data.summary.totalMinimumPayment);
    const capacityLabel = data.summary.monthlyDebtCapacity
      ? formatCurrency(data.summary.monthlyDebtCapacity)
      : null;
    const debtFreeLabel = data.summary.projectedDebtFreeDate
      ? formatDate(data.summary.projectedDebtFreeDate, "d MMM yyyy")
      : null;
    const steps: string[] = [
      data.habitSignals.momentumMessage,
      `Saldo total orientativo: ${totalDebtLabel}. Mínimos del mes: ${minLabel}.`,
      capacityLabel
        ? `Capacidad estimada para deudas este mes: ${capacityLabel}.`
        : "Si cargas ingresos y gastos esenciales, afinamos mejor cuánto puedes mover sin apretarte.",
    ];

    if (debtFreeLabel && data.summary.monthsToDebtFree != null) {
      steps.push(
        `Con el ritmo del plan, la salida orientativa ronda el ${debtFreeLabel} (~${data.summary.monthsToDebtFree} meses).`,
      );
    } else if (debtFreeLabel) {
      steps.push(`Salida orientativa del plan: ${debtFreeLabel}.`);
    }

    if (data.analysisScope.partialAnalysis) {
      steps.push(
        `Estamos viendo ${data.analysisScope.analyzedDebtCount} de ${data.analysisScope.activeDebtCount} deudas activas; suma el resto para un panorama completo.`,
      );
    }

    if (data.analysisScope.hiddenDebtCount > 0) {
      steps.push(
        `Hay ${data.analysisScope.hiddenDebtCount} deuda(s) con detalle incompleto; completarlas mejora prioridades y fechas.`,
      );
    }

    return {
      title: "Tu panorama en claro",
      body: `${data.habitSignals.microFeedback} ${data.upcomingTimeline.support}`.trim(),
      steps: steps.slice(0, 5),
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ver deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Resumen",
      badgeVariant: "default",
    };
  }

  if (isUpcomingEventsIntent) {
    const items = data.upcomingTimeline.items.slice(0, 5);
    const steps =
      items.length > 0
        ? items.map((item) => {
            const when = formatDate(item.occursOn, "d MMM");
            const distance =
              item.daysUntil <= 0 ? "hoy" : item.daysUntil === 1 ? "mañana" : `en ${item.daysUntil} días`;

            return `${item.debtName}: ${item.eventLabel} · ${when} (${distance}) — ${item.summary}`;
          })
        : [data.upcomingTimeline.emptyState ?? data.upcomingTimeline.support];

    return {
      title: data.upcomingTimeline.headline || "Próximos vencimientos",
      body: data.upcomingTimeline.support,
      steps,
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Calendario en deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Agenda",
      badgeVariant: "default",
    };
  }

  if (isMotivationIntent) {
    const streakLine =
      data.habitSignals.weeklyStreak > 0
        ? `Llevas ${data.habitSignals.weeklyStreak} semana(s) con seguimiento activo: es constancia real, no perfección.`
        : "Aunque la semana se desordene, anotar un pago o revisar montos ya cuenta como avance.";

    return {
      title: "Respira: esto es un maratón de decisiones pequeñas",
      body: "No hace falta resolver todo hoy. Clara está para ordenar el siguiente paso sin juicio y con números que puedas defender.",
      steps: [
        data.habitSignals.momentumMessage,
        streakLine,
        data.habitSignals.microFeedback,
        ...(data.habitSignals.reviewPrompt ? [data.habitSignals.reviewPrompt] : []),
      ].filter((line) => line.trim().length > 0),
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ir al simulador", href: "/simulador", variant: "secondary" },
      ],
      badgeLabel: "Ánimo",
      badgeVariant: "success",
    };
  }

  if (isRiskHelpIntent) {
    const alerts = data.riskAlerts.slice(0, 3);

    return {
      title: alerts.length > 0 ? "Señales que conviene atender" : "Por ahora vas sin alertas fuertes",
      body:
        alerts.length > 0
          ? "Resolver esto temprano suele costar menos que apagarlo después. Nada de drama: solo orden de acción."
          : data.habitSignals.momentumMessage,
      steps:
        alerts.length > 0
          ? alerts.map((alert) => `${alert.title}: ${alert.description}`)
          : [
              "Mantén los mínimos al día y prioriza lo que Clara marca arriba.",
              "Si algo se acerca a mora, registra aunque sea un pago parcial para no perder el hilo.",
            ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ver deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Riesgos",
      badgeVariant: alerts.length > 0 ? "warning" : "default",
    };
  }

  if (isSimulatorHelpIntent) {
    const hint = truncateClaraSentence(
      data.strategyExplanation ||
        "Compara bola de nieve, avalancha o híbrido moviendo el pago extra mensual y mira cómo cambian meses e intereses.",
    );

    return {
      title: "Prueba escenarios sin comprometer datos",
      body: "El simulador es un lienzo: cambias montos o estrategia y ves el impacto en meses hasta la meta. Tus saldos reales solo cambian cuando registras un pago.",
      steps: [
        hint,
        "Sube el extra de a poco para ver dónde se nota más el ahorro de interés o el acorte de plazo.",
      ],
      actions: [
        { label: "Abrir simulador", href: "/simulador", variant: "primary" },
        createPaymentAction(priorityDebt),
      ],
      badgeLabel: "Simulador",
      badgeVariant: "default",
    };
  }

  if (isOptimizePlanIntent) {
    if (!data.planComparison) {
      return {
        title: "Comparar planes todavía no aplica con estos datos",
        body: "Cuando haya escenarios comparables, Clara te mostrará meses ganados e intereses evitados. Mientras tanto, el simulador ya te da palanca para probar montos.",
        steps: [
          "Cubre mínimos y sigue la prioridad sugerida.",
          "Completa deudas faltantes o datos incompletos para que el comparador tenga base sólida.",
        ],
        actions: [
          { label: "Abrir simulador", href: "/simulador", variant: "primary" },
          { label: "Planes", href: "/planes", variant: "secondary" },
        ],
        badgeLabel: "Plan",
        badgeVariant: "default",
      };
    }

    const plan = data.planComparison;

    return {
      title: plan.headline,
      body: plan.description,
      steps: [
        plan.immediateAction,
        ...(plan.assumption ? [plan.assumption] : []),
        `Presupuesto sugerido para el escenario optimizado: ${formatCurrency(plan.suggestedMonthlyBudget)}.`,
      ].slice(0, 4),
      actions: [
        { label: "Abrir simulador", href: "/simulador", variant: "primary" },
        { label: "Planes", href: "/planes", variant: "secondary" },
      ],
      badgeLabel: "Optimizar",
      badgeVariant: "success",
    };
  }

  if (isBudgetIntent) {
    const minimumLabel = formatCurrency(data.summary.totalMinimumPayment);
    const capacityLabel = data.summary.monthlyDebtCapacity
      ? formatCurrency(data.summary.monthlyDebtCapacity)
      : null;

    return {
      title: "Si el dinero no alcanza, protege primero lo que evita mora.",
      body: capacityLabel
        ? `Tu capacidad estimada para deudas es ${capacityLabel}. Antes de pagar extra, cubre el mínimo del mes: ${minimumLabel}.`
        : `Empieza por cubrir el mínimo del mes: ${minimumLabel}. Si falta dinero, registra tus ingresos y gastos para que Clara ajuste la recomendación.`,
      steps: [
        `Prioridad de hoy: ${priorityDebtName}.`,
        suggestedAmountLabel
          ? `Monto sugerido para empezar: ${suggestedAmountLabel}.`
          : "Registra el monto que puedas cubrir hoy.",
        "Evita repartir dinero en demasiados frentes si hay vencimientos cerca.",
      ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ajustar ingresos y gastos", href: "/configuracion", variant: "secondary" },
      ],
      badgeLabel: "Presupuesto",
      badgeVariant: "warning",
    };
  }

  if (isLateIntent || priorityDebt?.status === "LATE") {
    return {
      title: `Atiende ${priorityDebtName} antes de abrir otro frente.`,
      body: dueDate
        ? `Esta deuda está presionando tu plan y vence ${dueDate}. Resolverla primero mantiene el resto más estable.`
        : "Esta deuda tiene la señal más urgente ahora mismo. Conviene resolverla antes de acelerar otra.",
      steps: [
        suggestedAmountLabel
          ? `Registra al menos ${suggestedAmountLabel}.`
          : "Registra el pago que puedas cubrir hoy.",
        "Después revisa si queda algún vencimiento cercano.",
        "Si no puedes cubrirla completa, anota el pago parcial para mantener el historial real.",
      ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ver todas mis deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Urgente",
      badgeVariant: "danger",
    };
  }

  if (isInterestIntent) {
    return {
      title: "Para bajar intereses, concentra el dinero donde más cuesta.",
      body:
        data.summary.estimatedMonthlyInterest > 0
          ? `Hoy estás cargando cerca de ${formatCurrency(data.summary.estimatedMonthlyInterest)} en intereses estimados este mes. Clara empezaría por ${priorityDebtName}.`
          : `Clara empezaría por ${priorityDebtName} y evitaría repartir pagos extras sin una prioridad.`,
      steps: [
        "Cubre mínimos para no crear mora.",
        `Envía el extra disponible a ${priorityDebtName}.`,
        "Usa el simulador para ver cuánto cambia el tiempo de salida.",
      ],
      actions: [
        { label: "Abrir simulador", href: "/simulador", variant: "primary" },
        createPaymentAction(priorityDebt),
      ],
      badgeLabel: "Ahorro",
      badgeVariant: "success",
    };
  }

  if (isPaymentIntent) {
    return {
      title: `Paga primero ${priorityDebtName}.`,
      body: suggestedAmountLabel
        ? `Mi recomendación rápida es registrar ${suggestedAmountLabel} para esa deuda y mantener el plan en movimiento.`
        : "Mi recomendación rápida es registrar un pago en esa deuda antes de mover dinero a otra.",
      steps: [
        suggestedAmountLabel
          ? `Usa ${suggestedAmountLabel} como punto de partida.`
          : "Captura el pago real que hiciste o harás.",
        "Si puedes pagar extra, no lo repartas: ponlo en la prioridad actual.",
        "Después revisa el simulador para confirmar el impacto.",
      ],
      actions: [
        createPaymentAction(priorityDebt),
        { label: "Ver deudas", href: "/deudas", variant: "secondary" },
      ],
      badgeLabel: "Siguiente pago",
      badgeVariant: "success",
    };
  }

  const coachSteps =
    data.assistantCoach.notes.length > 0
      ? data.assistantCoach.notes.slice(0, 3)
      : [
          `Prioridad actual: ${priorityDebtName}.`,
          "Registra tus pagos para que la recomendación mejore.",
          "Usa el simulador si quieres comparar escenarios.",
        ];
  const micro = data.habitSignals.microFeedback.trim();
  const mergedSteps =
    micro && !coachSteps.some((line) => line.includes(micro.slice(0, Math.min(48, micro.length))))
      ? [micro, ...coachSteps].slice(0, 4)
      : coachSteps;

  return {
    title: data.assistantCoach.title,
    body: data.assistantCoach.description,
    steps: mergedSteps,
    actions: [
      {
        label: data.assistantCoach.primaryAction.label,
        href: data.assistantCoach.primaryAction.href,
        variant: "primary",
      },
      ...(data.assistantCoach.secondaryAction
        ? [
            {
              label: data.assistantCoach.secondaryAction.label,
              href: data.assistantCoach.secondaryAction.href,
              variant: "secondary" as const,
            },
          ]
        : []),
    ],
    badgeLabel: data.assistantCoach.badgeLabel,
    badgeVariant: data.assistantCoach.badgeVariant,
  };
}
