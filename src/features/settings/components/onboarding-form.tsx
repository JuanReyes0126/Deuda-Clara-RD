"use client";

import { ArrowRight, BellRing, Sparkles } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validations/settings";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { formatCurrency } from "@/lib/utils/currency";

type OnboardingFormProps = {
  defaultValues: OnboardingInput;
  nextRoute: string;
  submitLabel: string;
  nextSteps: string[];
};

const budgetSuggestions = [
  { label: "RD$10,000", value: 10_000, note: "Si apenas cubres mínimos y quieres empezar ordenado." },
  { label: "RD$20,000", value: 20_000, note: "Un ritmo balanceado para salir sin asfixiar tu mes." },
  { label: "RD$30,000", value: 30_000, note: "Si puedes meter más flujo para salir antes." },
] as const;

const strategyOptions = [
  {
    id: "AVALANCHE",
    title: "Avalanche",
    description: "Reduce intereses más rápido atacando primero la tasa más alta.",
    idealFor: "Ideal si quieres eficiencia financiera pura.",
  },
  {
    id: "SNOWBALL",
    title: "Snowball",
    description: "Liquida primero los saldos pequeños para ganar impulso emocional.",
    idealFor: "Ideal si necesitas victorias rápidas para sostener el hábito.",
  },
  {
    id: "HYBRID",
    title: "Híbrido",
    description: "Equilibra tasa, saldo y urgencia para una ruta más humana.",
    idealFor: "Ideal si quieres claridad sin irte a extremos.",
  },
] as const;

function describeBudgetLevel(value: number) {
  if (value <= 0) {
    return "Todavía no has definido cuánto puedes dedicar a deudas.";
  }

  if (value < 10_000) {
    return "Es un punto de partida conservador. El sistema te ayudará a no perderte entre mínimos y vencimientos.";
  }

  if (value < 25_000) {
    return "Es un presupuesto razonable para empezar a ver progreso consistente sin tensionar demasiado tu flujo.";
  }

  return "Tienes un flujo fuerte para acelerar la salida. Aquí conviene acompañarlo con una ruta clara y disciplinada.";
}

export function OnboardingForm({
  defaultValues,
  nextRoute,
  submitLabel,
  nextSteps,
}: OnboardingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues,
  });
  const watchedBudget = Number(useWatch({ control: form.control, name: "monthlyDebtBudget" }) ?? 0);
  const watchedStrategy = useWatch({ control: form.control, name: "preferredStrategy" });
  const watchedEmailReminders = useWatch({ control: form.control, name: "emailRemindersEnabled" });
  const watchedDueSoon = useWatch({ control: form.control, name: "notifyDueSoon" });
  const watchedOverdue = useWatch({ control: form.control, name: "notifyOverdue" });
  const watchedMinimumRisk = useWatch({ control: form.control, name: "notifyMinimumRisk" });
  const selectedStrategy =
    strategyOptions.find((strategy) => strategy.id === watchedStrategy) ?? strategyOptions[0];
  const activeAlertCount = [watchedEmailReminders, watchedDueSoon, watchedOverdue, watchedMinimumRisk].filter(Boolean).length;
  const budgetSummary = useMemo(() => describeBudgetLevel(watchedBudget), [watchedBudget]);

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const payload = await readJsonPayload<{ error?: string }>(response);

    if (!response.ok) {
      setErrorMessage(payload.error ?? "No se pudo completar el onboarding.");
      setIsSubmitting(false);
      return;
    }

    toast.success("Tu configuración inicial fue guardada.");
    router.push(nextRoute as Route);
    router.refresh();
  });

  return (
    <form className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]" onSubmit={onSubmit}>
      <div className="grid gap-6">
        <div className="rounded-[1.75rem] border border-border bg-secondary/45 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-white text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Vamos a dejar tu punto de partida claro</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                No necesitas perfección ahora. Solo define cuánto puedes pagar al mes y cómo quieres que
                el sistema te ayude a decidir.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[1.75rem] border border-border bg-white p-5 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="monthlyDebtBudget">Presupuesto mensual para deudas (RD$)</Label>
            <Input
              id="monthlyDebtBudget"
              type="number"
              step="100"
              inputMode="decimal"
              {...form.register("monthlyDebtBudget", { valueAsNumber: true })}
            />
            <p className="text-sm text-muted">
              Piensa en el monto que realmente puedes sostener mes tras mes sin desordenar tus gastos básicos.
            </p>
            <p className="text-sm text-rose-600">
              {form.formState.errors.monthlyDebtBudget?.message}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {budgetSuggestions.map((suggestion) => (
              <button
                key={suggestion.value}
                type="button"
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  watchedBudget === suggestion.value
                    ? "border-primary/20 bg-primary/10 text-foreground"
                    : "border-border bg-secondary/60 text-muted hover:bg-white"
                }`}
                onClick={() => {
                  form.setValue("monthlyDebtBudget", suggestion.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
              >
                {suggestion.label}
              </button>
            ))}
          </div>

          <div className="rounded-3xl border border-primary/10 bg-[rgba(240,248,245,0.86)] px-4 py-4 text-sm leading-7 text-foreground">
            {budgetSuggestions.find((suggestion) => suggestion.value === watchedBudget)?.note ?? budgetSummary}
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label>Método preferido</Label>
            <p className="mt-2 text-sm text-muted">
              Puedes cambiarlo luego, pero escoger uno ahora ayuda a que el copiloto financiero te hable claro desde el primer día.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {strategyOptions.map((strategy) => {
              const isSelected = watchedStrategy === strategy.id;

              return (
                <button
                  key={strategy.id}
                  type="button"
                  className={`rounded-[1.75rem] border p-5 text-left transition ${
                    isSelected
                      ? "border-primary/25 bg-[rgba(240,248,245,0.92)] shadow-soft ring-2 ring-primary/10"
                      : "border-border bg-white hover:border-primary/15 hover:bg-secondary/35"
                  }`}
                  onClick={() => {
                    form.setValue("preferredStrategy", strategy.id, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-foreground">{strategy.title}</p>
                    <Badge variant={isSelected ? "success" : "default"}>
                      {isSelected ? "Elegido" : "Disponible"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted">{strategy.description}</p>
                  <p className="mt-3 text-sm font-medium text-foreground">{strategy.idealFor}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-border"
              {...form.register("emailRemindersEnabled")}
            />
            <span className="text-sm leading-7 text-muted">
              Quiero recordatorios opcionales por email sobre vencimientos y riesgos.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-border"
              {...form.register("notifyDueSoon")}
            />
            <span className="text-sm leading-7 text-muted">Alertas por vencimientos cercanos.</span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-border"
              {...form.register("notifyOverdue")}
            />
            <span className="text-sm leading-7 text-muted">Alertas por atraso o mora.</span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border-border"
              {...form.register("notifyMinimumRisk")}
            />
            <span className="text-sm leading-7 text-muted">
              Avisarme si estoy entrando al ciclo de pagar solo mínimos.
            </span>
          </label>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6">
        <div className="rounded-[1.75rem] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,248,241,0.92)_100%)] p-6 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Resumen inicial
          </p>
          <p className="mt-3 font-display text-3xl tracking-tight text-foreground">
            {watchedBudget > 0 ? formatCurrency(watchedBudget) : "Define tu presupuesto"}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            {budgetSummary}
          </p>

          <div className="mt-5 rounded-3xl border border-white/60 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Ruta elegida</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{selectedStrategy.title}</p>
            <p className="mt-2 text-sm leading-7 text-muted">{selectedStrategy.description}</p>
          </div>

          <div className="mt-4 rounded-3xl border border-white/60 bg-white/80 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-secondary text-primary">
                <BellRing className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Alertas activas</p>
                <p className="text-sm text-muted">{activeAlertCount} activadas desde el inicio</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">
              Puedes ajustar esto luego, pero salir con alertas básicas activadas reduce olvidos y mora.
            </p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold text-foreground">Lo que viene después</p>
          <div className="mt-4 space-y-3">
            {nextSteps.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-muted">
                <span className="grid size-8 place-items-center rounded-full bg-secondary text-primary">
                  <ArrowRight className="size-4" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
