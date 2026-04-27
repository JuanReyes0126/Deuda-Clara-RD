import type { DashboardDto, DebtItemDto } from "@/lib/types/app";

export type AssistantAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

export type AssistantReply = {
  title: string;
  body: string;
  steps: string[];
  actions: AssistantAction[];
  paymentDraft?: PaymentDraft;
  paymentDrafts?: PaymentDraft[];
  badgeLabel: string;
  badgeVariant: "default" | "warning" | "danger" | "success";
};

export type PaymentDraft = {
  debtId: string;
  debtName: string;
  creditorName: string;
  amount: number;
  currency: DebtItemDto["currency"];
  sourcePrompt: string;
  usedSuggestedAmount: boolean;
};

export type VisionDebtExtraction = {
  name: string | null;
  creditorName: string | null;
  currentBalance: number | null;
  minimumPayment: number | null;
  paymentAmount: number | null;
  interestRate: number | null;
  interestRateType: "ANNUAL" | "MONTHLY" | null;
  productType: "CREDIT_CARD" | "LOAN" | "INFORMAL" | "UNKNOWN";
  currency: DebtItemDto["currency"] | null;
  dueDateText: string | null;
  detectedAction: "payment" | "statement" | "unknown";
  confidence: "low" | "medium" | "high";
};

export type VisionExtractionResult = {
  debts: VisionDebtExtraction[];
  summary: string;
  missingFields: string[];
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  reply?: AssistantReply;
};

export type ClaraChatPaymentMemory = {
  id: string;
  recordedAt: string;
  debtName: string;
  amount: number;
  currency: DebtItemDto["currency"];
  source: "clara_chat_single" | "clara_chat_bulk";
};

export type DashboardAssistantChatProps = {
  data: DashboardDto;
  storageKey: string;
};

export type ImageInputSource = "archivo" | "arrastre" | "portapapeles";
