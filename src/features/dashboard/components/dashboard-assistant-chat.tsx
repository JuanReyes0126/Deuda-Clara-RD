"use client";

import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ImageIcon,
  Loader2,
  MessageCircle,
  PencilLine,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  pickClaraAckMessage,
  pickClaraImageOkMessage,
  quickPrompts,
} from "@/features/dashboard/lib/dashboard-assistant-chat.constants";
import {
  buildAssistantReply,
  buildImageAssistantReply,
  getImageTransferFile,
  hasImageTransfer,
  sanitizePaymentLog,
  sanitizePersistedChatMessages,
} from "@/features/dashboard/lib/dashboard-assistant-chat.logic";
import type {
  AssistantReply,
  ChatMessage,
  ClaraChatPaymentMemory,
  DashboardAssistantChatProps,
  ImageInputSource,
  PaymentDraft,
  VisionExtractionResult,
} from "@/features/dashboard/lib/dashboard-assistant-chat.types";
import { readClaraChatRaw, writeClaraChatRaw } from "@/features/dashboard/lib/clara-chat-storage";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { useAppNavigation } from "@/lib/navigation/use-app-navigation";
import { formatCurrency } from "@/lib/utils/currency";

export function DashboardAssistantChat({ data, storageKey }: DashboardAssistantChatProps) {
  const { navigate } = useAppNavigation();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isRegisteringPayment, setIsRegisteringPayment] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [paymentLog, setPaymentLog] = useState<ClaraChatPaymentMemory[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const dragDepthRef = useRef(0);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const initialReply = useMemo(
    () =>
      buildAssistantReply(data, "¿Qué hago ahora?", {
        paymentLog: [],
        priorUserMessages: [],
      }),
    [data],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-initial",
      role: "assistant",
      content:
        "Hola, soy Clara. Cuéntame en una frase qué pagaste (hasta varios con “y”), o pega una captura; yo preparo y tú confirmas cuando quieras.",
      reply: initialReply,
    },
  ]);
  const latestAssistantReply = [...messages]
    .reverse()
    .find((message) => message.role === "assistant")?.reply;
  const pendingPaymentDrafts =
    latestAssistantReply?.paymentDrafts ??
    (latestAssistantReply?.paymentDraft ? [latestAssistantReply.paymentDraft] : []);

  useEffect(() => {
    const messageList = messageListRef.current;

    if (!messageList) {
      return;
    }

    messageList.scrollTo({
      top: messageList.scrollHeight,
      behavior: "smooth",
    });
  }, [isAnalyzingImage, messages]);

  useEffect(() => {
    const raw = readClaraChatRaw(storageKey);

    if (!raw) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        v?: number;
        messages?: unknown[];
        paymentLog?: unknown;
      };

      if (parsed.v !== 1 || !Array.isArray(parsed.messages)) {
        setHydrated(true);
        return;
      }

      const restored = sanitizePersistedChatMessages(parsed.messages);

      if (restored.length > 0) {
        setMessages(restored);
      }

      setPaymentLog(sanitizePaymentLog(parsed.paymentLog));
    } catch {
      // ignore corrupt storage
    }

    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      writeClaraChatRaw(
        storageKey,
        JSON.stringify({
          v: 1,
          updatedAt: new Date().toISOString(),
          messages: messages.slice(-100),
          paymentLog: paymentLog.slice(-80),
        }),
      );
    }, 400);

    return () => window.clearTimeout(timer);
  }, [hydrated, messages, paymentLog, storageKey]);

  const sendPrompt = (prompt: string) => {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      return;
    }

    const priorUserMessages = messages
      .filter((entry) => entry.role === "user")
      .map((entry) => entry.content);
    const reply = buildAssistantReply(data, trimmedPrompt, {
      paymentLog,
      priorUserMessages,
    });

    setMessages((current) => {
      const nextIndex = current.length;

      return [
        ...current,
        {
          id: `user-${nextIndex}`,
          role: "user",
          content: trimmedPrompt,
        },
        {
          id: `assistant-${nextIndex}`,
          role: "assistant",
          content: pickClaraAckMessage(),
          reply,
        },
      ];
    });
    setInput("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendPrompt(input);
  };

  const appendAssistantReply = (reply: AssistantReply, content: string) => {
    setMessages((current) => {
      const nextIndex = current.length;

      return [
        ...current,
        {
          id: `assistant-${nextIndex}`,
          role: "assistant",
          content,
          reply,
        },
      ];
    });
  };

  const appendUserMessage = (content: string) => {
    setMessages((current) => {
      const nextIndex = current.length;

      return [
        ...current,
        {
          id: `user-${nextIndex}`,
          role: "user",
          content,
        },
      ];
    });
  };

  const processImageFile = (file: File | null, source: ImageInputSource) => {
    if (!file) {
      return;
    }

    if (isAnalyzingImage) {
      toast.info("Clara ya está leyendo una imagen.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen válida.");
      return;
    }

    if (file.size > 5_000_000) {
      toast.error("La imagen pesa demasiado. Usa una captura más recortada.");
      return;
    }

    const reader = new FileReader();
    const currentPrompt = input.trim();
    const sourceLabel =
      source === "arrastre"
        ? "Arrastré"
        : source === "portapapeles"
          ? "Pegué"
          : "Subí";

    setIsAnalyzingImage(true);
    setIsDraggingImage(false);
    appendUserMessage(
      `${sourceLabel} una imagen para que Clara la lea: ${file.name}`,
    );

    reader.onload = async () => {
      try {
        const imageDataUrl = String(reader.result ?? "");
        const response = await fetchWithCsrf("/api/assistant/image-extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageDataUrl,
            prompt: currentPrompt,
          }),
        });
        const payload = await readJsonPayload<{
          error?: string;
          extraction?: VisionExtractionResult;
        }>(response);

        if (!response.ok || !payload.extraction) {
          appendAssistantReply(
            {
              title: "Recibí la foto, pero la lectura automática no está activa.",
              body:
                payload.error ??
                "Para leer fotos como ChatGPT necesitamos activar visión/OCR con una API key. Mientras tanto, escribe el saldo y pago mínimo y Clara prepara la acción.",
              steps: [
                "Puedes escribir: “Clara, pagué RD$5,000 al préstamo del Popular”.",
                "También puedes escribir saldo, pago mínimo y banco.",
                "Cuando visión esté activa, Clara extraerá esos datos desde la imagen.",
              ],
              actions: [],
              badgeLabel: "Falta visión",
              badgeVariant: "warning",
            },
            "No pude leer la imagen automáticamente.",
          );
          return;
        }

        appendAssistantReply(
          buildImageAssistantReply(data, payload.extraction, file.name),
          pickClaraImageOkMessage(),
        );
      } catch (error) {
        appendAssistantReply(
          {
            title: "No pude analizar la imagen.",
            body:
              error instanceof Error
                ? error.message
                : "Intenta de nuevo con una captura más clara.",
            steps: [
              "Usa una imagen donde se vea el saldo.",
              "Incluye el pago mínimo si aparece.",
              "Evita capturas muy grandes o borrosas.",
            ],
            actions: [],
            badgeLabel: "Imagen",
            badgeVariant: "warning",
          },
          "La imagen no se pudo procesar.",
        );
      } finally {
        setIsAnalyzingImage(false);
      }
    };

    reader.onerror = () => {
      setIsAnalyzingImage(false);
      toast.error("No pude cargar esa imagen.");
    };

    reader.readAsDataURL(file);
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    processImageFile(event.target.files?.[0] ?? null, "archivo");
    event.target.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageTransfer(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingImage(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageTransfer(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingImage(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageTransfer(event)) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsDraggingImage(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingImage(false);
    let file = getImageTransferFile(event.dataTransfer.files);

    if (!file) {
      for (const item of Array.from(event.dataTransfer.items ?? [])) {
        if (item.kind !== "file") {
          continue;
        }

        const candidate = item.getAsFile();

        if (candidate?.type.startsWith("image/")) {
          file = candidate;
          break;
        }
      }
    }

    processImageFile(file, "arrastre");
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pastedImage = getImageTransferFile(event.clipboardData.files);

    if (!pastedImage) {
      return;
    }

    event.preventDefault();
    processImageFile(pastedImage, "portapapeles");
  };

  const createPaymentFromDraft = async (draft: PaymentDraft) => {
    const response = await fetchWithCsrf("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        debtId: draft.debtId,
        amount: draft.amount,
        source: "MANUAL",
        paidAt: new Date().toISOString().slice(0, 10),
        notes: `Registrado desde Clara: ${draft.sourcePrompt.slice(0, 220)}`,
      }),
    });
    const payload = await readJsonPayload<{ error?: string }>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? "No se pudo registrar el pago.");
    }
  };

  const registerPaymentDraft = async (draft: PaymentDraft) => {
    if (isRegisteringPayment) {
      return;
    }

    try {
      setIsRegisteringPayment(true);
      await createPaymentFromDraft(draft);

      toast.success("Clara registró el pago.");
      setPaymentLog((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          recordedAt: new Date().toISOString(),
          debtName: draft.debtName,
          amount: draft.amount,
          currency: draft.currency,
          source: "clara_chat_single",
        },
      ]);
      setMessages((current) => {
        const nextIndex = current.length;

        return [
          ...current,
          {
            id: `assistant-payment-${nextIndex}`,
            role: "assistant",
            content: "Listo, ya quedó guardado. Lo dejé anotado para cuando preguntes por lo que llevamos.",
            reply: {
              title: `${formatCurrency(draft.amount, draft.currency)} registrado en ${draft.debtName}.`,
              body:
                "Ya guardé el pago en tu historial. El dashboard se actualizará con el nuevo saldo y avance.",
              steps: [
                `Deuda actualizada: ${draft.debtName}.`,
                "Historial de pagos actualizado.",
                "Puedes revisar el detalle en Pagos.",
              ],
              actions: [
                { label: "Ver pagos", href: "/pagos", variant: "primary" },
                { label: "Ver deudas", href: "/deudas", variant: "secondary" },
              ],
              badgeLabel: "Registrado",
              badgeVariant: "success",
            },
          },
        ];
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el pago.",
      );
    } finally {
      setIsRegisteringPayment(false);
    }
  };

  const registerPaymentDrafts = async (drafts: PaymentDraft[]) => {
    if (isRegisteringPayment || drafts.length === 0) {
      return;
    }

    try {
      setIsRegisteringPayment(true);

      for (const draft of drafts) {
        await createPaymentFromDraft(draft);
      }

      toast.success("Clara registró los pagos.");
      setPaymentLog((current) => [
        ...current,
        ...drafts.map((draft) => ({
          id: crypto.randomUUID(),
          recordedAt: new Date().toISOString(),
          debtName: draft.debtName,
          amount: draft.amount,
          currency: draft.currency,
          source: "clara_chat_bulk" as const,
        })),
      ]);
      setMessages((current) => {
        const nextIndex = current.length;
        const totalAmountByCurrency = drafts.reduce(
          (totals, draft) => {
            totals[draft.currency] += draft.amount;
            return totals;
          },
          { DOP: 0, USD: 0 },
        );
        const totalLabels = [
          totalAmountByCurrency.DOP > 0
            ? formatCurrency(totalAmountByCurrency.DOP, "DOP")
            : null,
          totalAmountByCurrency.USD > 0
            ? formatCurrency(totalAmountByCurrency.USD, "USD")
            : null,
        ].filter(Boolean);

        return [
          ...current,
          {
            id: `assistant-payment-bulk-${nextIndex}`,
            role: "assistant",
            content:
              "Multi registro listo. Cada pago quedó en tu cuenta y en la memoria de esta charla por si luego me preguntas.",
            reply: {
              title: `${drafts.length} pagos registrados por Clara.`,
              body: `Ya guardé el multi registro${totalLabels.length ? ` por ${totalLabels.join(" y ")}` : ""}. El dashboard se actualizará con los nuevos saldos.`,
              steps: drafts.map(
                (draft) =>
                  `${draft.debtName}: ${formatCurrency(draft.amount, draft.currency)}.`,
              ),
              actions: [
                { label: "Ver pagos", href: "/pagos", variant: "primary" },
                { label: "Ver dashboard", href: "/dashboard", variant: "secondary" },
              ],
              badgeLabel: "Multi pago",
              badgeVariant: "success",
            },
          },
        ];
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudieron registrar todos los pagos.",
      );
    } finally {
      setIsRegisteringPayment(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-primary/12 bg-[radial-gradient(circle_at_top_left,rgba(13,148,136,0.12),transparent_38%),linear-gradient(135deg,rgba(248,252,250,0.99),rgba(255,252,248,0.96))] p-4 shadow-[0_10px_36px_rgba(15,88,74,0.07)] sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/95 text-white shadow-[0_8px_20px_rgba(15,88,74,0.14)] sm:size-12">
              <Bot className="size-[1.15rem] sm:size-5" />
            </span>
            <div>
              <p className="section-kicker">Mini IA Clara</p>
              <h2 className="text-foreground mt-1 text-2xl font-semibold leading-tight sm:text-3xl">
                Habla con Clara sin complicarte.
              </h2>
              <p className="text-muted mt-1.5 max-w-xl text-sm leading-relaxed">
                Sin mil pasos: escribe como en un chat y, si quieres, un solo clic
                guarda pagos. Tú mandas; yo ordeno.
              </p>
            </div>
            {latestAssistantReply ? (
              <Badge variant={latestAssistantReply.badgeVariant}>
                {latestAssistantReply.badgeLabel}
              </Badge>
            ) : null}
          </div>

          <p className="section-summary mt-3 max-w-3xl text-sm leading-6 text-muted sm:text-[0.9375rem] sm:leading-7">
            Puedes decir “pagué este préstamo”, “no me alcanza” o “¿qué pagos llevamos
            en el chat?”. Lo de esta ventana queda en tu navegador para retomarlo;
            nada de formularios largos si no quieres.
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
            {quickPrompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-9 rounded-full border border-primary/10 bg-white/55 px-3.5 text-xs font-medium text-foreground shadow-none hover:border-primary/18 hover:bg-white/90 sm:min-h-10 sm:text-[0.8125rem]"
                onClick={() => sendPrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>

          {latestAssistantReply ? (
            <div className="mt-5 rounded-[1.5rem] border border-border/50 bg-white/75 p-4 shadow-[0_4px_24px_rgba(24,49,59,0.04)]">
              <div className="flex items-start gap-3">
                <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-tight text-foreground">
                    {latestAssistantReply.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {latestAssistantReply.body}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                {latestAssistantReply.steps.map((step) => (
                  <div
                    key={step}
                    className="flex items-start gap-2 rounded-xl bg-secondary/35 px-3 py-1.5 text-sm leading-6 text-foreground"
                  >
                    <CircleDollarSign className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              {pendingPaymentDrafts.length > 0 ? (
                <div className="mt-4 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {pendingPaymentDrafts.length > 1
                          ? `Clara puede registrar ${pendingPaymentDrafts.length} pagos por ti.`
                          : "Clara puede guardarlo por ti."}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {pendingPaymentDrafts.length > 1
                          ? "Revisa el multi registro antes de confirmarlo."
                          : "Confirma si la deuda y el monto están correctos."}
                      </p>
                      {pendingPaymentDrafts.length > 1 ? (
                        <div className="mt-3 grid gap-2">
                          {pendingPaymentDrafts.map((draft) => (
                            <div
                              key={`${draft.debtId}:${draft.amount}`}
                              className="rounded-2xl bg-white/80 px-3 py-2 text-sm text-foreground"
                            >
                              <span className="font-semibold">{draft.debtName}</span>{" "}
                              <span className="text-muted">
                                {formatCurrency(draft.amount, draft.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        className="min-h-11"
                        disabled={isRegisteringPayment}
                        onClick={() =>
                          pendingPaymentDrafts.length > 1
                            ? registerPaymentDrafts(pendingPaymentDrafts)
                            : registerPaymentDraft(pendingPaymentDrafts[0]!)
                        }
                      >
                        {isRegisteringPayment ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {pendingPaymentDrafts.length > 1
                          ? "Confirmar multi registro"
                          : "Confirmar y registrar"}
                      </Button>
                      {pendingPaymentDrafts.length === 1 ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-11"
                          onClick={() =>
                            navigate(
                              `/pagos?from=clara-chat&debtId=${pendingPaymentDrafts[0]!.debtId}&amount=${pendingPaymentDrafts[0]!.amount}`,
                            )
                          }
                        >
                          <PencilLine className="size-4" />
                          Editar antes
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-11"
                          onClick={() => navigate("/pagos?from=clara-chat")}
                        >
                          <PencilLine className="size-4" />
                          Revisar manual
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {latestAssistantReply.actions.length > 0 ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {latestAssistantReply.actions.map((action) => (
                    <Button
                      key={`${action.href}:${action.label}`}
                      type="button"
                      variant={
                        action.variant === "secondary" ? "secondary" : "primary"
                      }
                      className="min-h-11 w-full sm:w-auto"
                      onClick={() => navigate(action.href)}
                    >
                      {action.label}
                      {action.variant === "primary" ? (
                        <ArrowRight className="size-4" />
                      ) : null}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={`relative rounded-[1.75rem] border bg-white/84 p-3 shadow-[0_4px_20px_rgba(24,49,59,0.04)] outline-none transition sm:p-4 ${
            isDraggingImage
              ? "border-primary/45 ring-primary/15 ring-2"
              : "border-stone-200/50"
          }`}
          role="region"
          tabIndex={0}
          aria-label="Chat con Clara. Puedes escribir, pegar o arrastrar imágenes."
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          {isDraggingImage ? (
            <div className="absolute inset-3 z-20 grid place-items-center rounded-[1.55rem] border-2 border-dashed border-primary/55 bg-white/92 text-center shadow-soft backdrop-blur-sm">
              <div className="max-w-xs px-5">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <UploadCloud className="size-6" />
                </span>
                <p className="mt-3 text-base font-semibold text-foreground">
                  Suelta aquí, sin estrés
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Si se ve bien, saco saldo, mínimo y banco. Si no, igual puedes
                  escribirlo en una línea.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                <MessageCircle className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Charla
                </p>
                <p className="text-xs text-muted">
                  Usa tus datos del dashboard; nada de cuestionarios.
                </p>
              </div>
            </div>
            <Badge variant="default" className="font-normal opacity-90">
              Contigo
            </Badge>
          </div>

          <div className="mb-3 flex items-start gap-3 rounded-[1.2rem] border border-primary/8 bg-primary/[0.04] px-3 py-2.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-white/90 text-primary shadow-sm">
              <UploadCloud className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Captura: arrastra, suelta o pega (Cmd/Ctrl + V)
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                Opcional. Si prefieres, solo escribe el monto y la deuda.
              </p>
            </div>
          </div>

          <div
            ref={messageListRef}
            className="max-h-[min(22rem,52dvh)] space-y-2.5 overflow-y-auto rounded-[1.35rem] bg-secondary/25 p-3 sm:space-y-3"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-[1.15rem] px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-primary text-white shadow-sm"
                      : "border border-stone-200/65 bg-white/95 text-foreground shadow-[0_1px_8px_rgba(24,49,59,0.04)]"
                  }`}
                >
                  <p>{message.content}</p>
                  {message.reply ? (
                    <p className="mt-2 border-t border-black/[0.06] pt-2 text-xs text-muted/90">
                      {message.reply.title}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
            {isAnalyzingImage ? (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[1.15rem] border border-primary/10 bg-white/95 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    <span>Un momento, revisando la imagen…</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Tómate un respiro; si la captura es legible, saco lo importante.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <form className="mt-3 flex gap-2" onSubmit={handleSubmit}>
            <label className="border-border text-primary hover:border-primary/30 hover:bg-primary/5 grid min-h-12 cursor-pointer place-items-center rounded-2xl border bg-white px-3 transition">
              {isAnalyzingImage ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              <span className="sr-only">Subir imagen para Clara</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={isAnalyzingImage}
                onChange={handleImageUpload}
              />
            </label>
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder="Ej.: pagué 3mil al Popular — o suelta una captura"
              aria-label="Mensaje para Clara"
              className="min-h-12 border-stone-200/80 bg-white/95 placeholder:text-muted/70"
            />
            <Button type="submit" className="min-h-12 px-4">
              <Send className="size-4" />
              <span className="sr-only">Enviar mensaje</span>
            </Button>
          </form>

          <p className="mt-3 px-1 text-xs leading-5 text-muted">
            Escribe, arrastra o pega en el cuadro. La memoria de esta charla es
            solo en tu navegador. Clara resume lo que ya tienes en la app; no
            sustituye asesoría financiera, legal ni contable.
          </p>
        </div>
      </div>
    </section>
  );
}
