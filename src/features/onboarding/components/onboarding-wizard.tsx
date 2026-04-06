"use client";

import { ArrowLeft, ArrowRight, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  ONBOARDING_DEBT_PRESETS,
  ONBOARDING_MAX_DEBTS,
  ONBOARDING_TRUST_COPY,
  type OnboardingDebtPresetType,
} from "@/config/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import type { OnboardingPreviewDto } from "@/lib/types/app";
import type { OnboardingInput } from "@/lib/validations/settings";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

type OnboardingWizardProps = {
  defaultValues: OnboardingInput;
};

const totalSteps = 5;

function getPresetName(presetType: OnboardingDebtPresetType, index: number) {
  const preset = ONBOARDING_DEBT_PRESETS[presetType];
  return `${preset.label} ${index + 1}`;
}

function buildEmptyDebt(index = 0): OnboardingInput["debts"][number] {
  return {
    name: getPresetName("CREDIT_CARD", index),
    presetType: "CREDIT_CARD",
    currentBalance: 0,
    minimumPayment: 0,
    interestRate: ONBOARDING_DEBT_PRESETS.CREDIT_CARD.annualRate,
  };
}

function getStepTitle(step: number) {
  if (step === 1) {
    return "Ponle claridad a tus deudas";
  }

  if (step === 2) {
    return "¿Cuánto ganas al mes?";
  }

  if (step === 3) {
    return "Agrega tus deudas principales";
  }

  if (step === 4) {
    return "¿Cuánto puedes pagar al mes?";
  }

  return "Así se vería tu salida";
}

function getStepDescription(step: number) {
  if (step === 1) {
    return "En menos de 2 minutos te mostramos cuándo sales y cómo pagar menos intereses.";
  }

  if (step === 2) {
    return "Esto nos ayuda a sugerirte un plan realista.";
  }

  if (step === 3) {
    return "Empieza con 1 a 3 deudas. No necesitas tenerlo perfecto para recibir una ruta útil.";
  }

  if (step === 4) {
    return "Puedes empezar con el mínimo y luego ajustar.";
  }

  return "Este resultado sale del planner del servidor con los datos que acabas de registrar.";
}

export function OnboardingWizard({ defaultValues }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<OnboardingPreviewDto | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const form = useForm<OnboardingInput>({
    defaultValues,
  });
  const debtsFieldArray = useFieldArray({
    control: form.control,
    name: "debts",
  });
  const watchedDebts = useWatch({
    control: form.control,
    name: "debts",
  }) ?? [];
  const watchedBudget = useWatch({
    control: form.control,
    name: "monthlyDebtBudget",
  });
  const minimumSuggestedBudget = watchedDebts.reduce(
    (sum, debt) => sum + Number(debt?.minimumPayment ?? 0),
    0,
  );

  async function loadPreview() {
    setIsLoadingPreview(true);
    setStepError(null);

    const response = await fetchWithCsrf("/api/auth/onboarding/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.getValues()),
    });
    const payload = await readJsonPayload<OnboardingPreviewDto & { error?: string }>(response);

    if (!response.ok) {
      setStepError(payload.error ?? "No se pudo calcular tu plan inicial.");
      setIsLoadingPreview(false);
      return false;
    }

    setPreview(payload);
    setIsLoadingPreview(false);
    return true;
  }

  async function goToNextStep() {
    setStepError(null);

    if (currentStep === 1) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      const isValid = await form.trigger("monthlyIncome");

      if (isValid) {
        setCurrentStep(3);
      }
      return;
    }

    if (currentStep === 3) {
      if (debtsFieldArray.fields.length === 0) {
        setStepError("Debes registrar al menos una deuda.");
        return;
      }

      const isValid = await form.trigger("debts");

      if (isValid) {
        setCurrentStep(4);
      }
      return;
    }

    if (currentStep === 4) {
      const isValid = await form.trigger("monthlyDebtBudget");

      if (!isValid) {
        return;
      }

      const previewLoaded = await loadPreview();

      if (previewLoaded) {
        setCurrentStep(5);
      }
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    setStepError(null);

    const response = await fetchWithCsrf("/api/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await readJsonPayload<{ error?: string }>(response);

    if (!response.ok) {
      setStepError(payload.error ?? "No se pudo completar tu onboarding.");
      setIsSubmitting(false);
      return;
    }

    toast.success("Tu plan inicial ya está listo.");
    router.push("/dashboard" as Route);
    router.refresh();
  });

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-border bg-white/95 p-5 shadow-soft sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Paso {currentStep}/{totalSteps}
              </p>
              <h1 className="mt-3 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                {getStepTitle(currentStep)}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
                {getStepDescription(currentStep)}
              </p>
            </div>
            <Badge variant="success">Menos de 2 minutos</Badge>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-[linear-gradient(135deg,#0f584a_0%,#218471_100%)] transition-all"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </section>

      <form className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" onSubmit={onSubmit}>
        <div className="grid gap-6">
          {currentStep === 1 ? (
            <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">
                    Ponle claridad a tus deudas
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    En menos de 2 minutos te mostramos cuándo sales y cómo pagar menos intereses.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 rounded-[1.5rem] border border-primary/10 bg-[rgba(240,248,245,0.88)] p-5">
                <p className="text-sm font-medium text-foreground">Esto es lo que te llevas hoy:</p>
                <ul className="grid gap-3 text-sm leading-7 text-muted">
                  <li>Verás tu fecha de salida.</li>
                  <li>Te diremos por dónde empezar.</li>
                  <li>Sin conectar cuentas bancarias.</li>
                </ul>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-border bg-secondary/35 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Siempre a tiempo
                </p>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Te avisamos antes del corte y antes del pago para que no se te pase nada.
                </p>
              </div>
            </section>
          ) : null}

          {currentStep === 2 ? (
            <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft sm:p-8">
              <div className="space-y-3">
                <Label htmlFor="monthlyIncome">Ingreso mensual (RD$)</Label>
                <Input
                  id="monthlyIncome"
                  type="number"
                  inputMode="decimal"
                  placeholder="Ej: 35,000"
                  {...form.register("monthlyIncome", {
                    required: "Debes indicar tu ingreso mensual.",
                    validate: (value) => {
                      if (!Number.isFinite(value)) {
                        return "Debes introducir un monto válido.";
                      }

                      if (value <= 0) {
                        return "Debes introducir un monto mayor que cero.";
                      }

                      if (value > 999_999_999) {
                        return "El monto es demasiado alto.";
                      }

                      return true;
                    },
                    setValueAs: (value) =>
                      value === "" ? Number.NaN : Number(value),
                  })}
                />
                <p className="text-sm text-muted">
                  Esto nos ayuda a sugerirte un plan realista.
                </p>
                <p className="text-sm text-rose-600">
                  {form.formState.errors.monthlyIncome?.message}
                </p>
              </div>
            </section>
          ) : null}

          {currentStep === 3 ? (
            <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Agrega entre 1 y {ONBOARDING_MAX_DEBTS} deudas
                  </p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    Puedes empezar con tarjeta y préstamo personal. Luego ajustas detalles desde tu panel.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(
                    Object.keys(ONBOARDING_DEBT_PRESETS) as OnboardingDebtPresetType[]
                  ).map((presetType) => (
                    <Button
                      key={presetType}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (debtsFieldArray.fields.length >= ONBOARDING_MAX_DEBTS) {
                          setStepError(`Solo puedes registrar hasta ${ONBOARDING_MAX_DEBTS} deudas ahora.`);
                          return;
                        }

                        const nextIndex = debtsFieldArray.fields.length;
                        debtsFieldArray.append({
                          ...buildEmptyDebt(nextIndex),
                          name: getPresetName(presetType, nextIndex),
                          presetType,
                          interestRate:
                            ONBOARDING_DEBT_PRESETS[presetType].annualRate,
                        });
                        setStepError(null);
                      }}
                    >
                      <Plus className="mr-2 size-4" />
                      {ONBOARDING_DEBT_PRESETS[presetType].label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {debtsFieldArray.fields.map((field, index) => {
                  const currentPreset = watchedDebts[index]?.presetType ?? "CREDIT_CARD";

                  return (
                    <div
                      key={field.id}
                      className="rounded-[1.5rem] border border-border bg-secondary/30 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Deuda {index + 1}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted">
                            {ONBOARDING_DEBT_PRESETS[currentPreset].label}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            debtsFieldArray.remove(index);
                            setStepError(null);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Quitar
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`debt-name-${index}`}>Nombre</Label>
                          <Input
                            id={`debt-name-${index}`}
                            placeholder="Ej: Tarjeta principal"
                            {...form.register(`debts.${index}.name`, {
                              required: "El nombre es obligatorio.",
                              validate: (value) =>
                                value.trim().length > 0 || "El nombre es obligatorio.",
                              setValueAs: (value) => value.trim(),
                            })}
                          />
                          <p className="text-sm text-rose-600">
                            {form.formState.errors.debts?.[index]?.name?.message}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`debt-type-${index}`}>Tipo</Label>
                          <select
                            id={`debt-type-${index}`}
                            className="flex h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground"
                            {...form.register(`debts.${index}.presetType`, {
                              onChange: (event) => {
                                const presetType = event.target
                                  .value as OnboardingDebtPresetType;
                                form.setValue(
                                  `debts.${index}.interestRate`,
                                  ONBOARDING_DEBT_PRESETS[presetType].annualRate,
                                  {
                                    shouldDirty: true,
                                    shouldTouch: true,
                                  },
                                );
                              },
                            })}
                          >
                            <option value="CREDIT_CARD">Tarjeta</option>
                            <option value="PERSONAL_LOAN">Préstamo personal</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`debt-balance-${index}`}>Balance (RD$)</Label>
                          <Input
                            id={`debt-balance-${index}`}
                            type="number"
                            inputMode="decimal"
                            placeholder="Ej: 85,000"
                            {...form.register(`debts.${index}.currentBalance`, {
                              required: "El balance es obligatorio.",
                              validate: (value) => {
                                if (!Number.isFinite(value)) {
                                  return "Debes introducir un monto válido.";
                                }

                                if (value <= 0) {
                                  return "Debes introducir un monto mayor que cero.";
                                }

                                return true;
                              },
                              setValueAs: (value) =>
                                value === "" ? Number.NaN : Number(value),
                            })}
                          />
                          <p className="text-sm text-rose-600">
                            {form.formState.errors.debts?.[index]?.currentBalance?.message}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`debt-minimum-${index}`}>Pago mínimo (RD$)</Label>
                          <Input
                            id={`debt-minimum-${index}`}
                            type="number"
                            inputMode="decimal"
                            placeholder="Ej: 4,500"
                            {...form.register(`debts.${index}.minimumPayment`, {
                              required: "El pago mínimo es obligatorio.",
                              validate: (value) => {
                                if (!Number.isFinite(value)) {
                                  return "Debes introducir un monto válido.";
                                }

                                if (value <= 0) {
                                  return "Debes introducir un monto mayor que cero.";
                                }

                                return true;
                              },
                              setValueAs: (value) =>
                                value === "" ? Number.NaN : Number(value),
                            })}
                          />
                          <p className="text-sm text-rose-600">
                            {form.formState.errors.debts?.[index]?.minimumPayment?.message}
                          </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor={`debt-rate-${index}`}>Tasa anual (%)</Label>
                          <Input
                            id={`debt-rate-${index}`}
                            type="number"
                            inputMode="decimal"
                            placeholder={`Ej: ${ONBOARDING_DEBT_PRESETS[currentPreset].annualRate}`}
                            {...form.register(`debts.${index}.interestRate`, {
                              validate: (value) => {
                                if (value === undefined || value === null || value === 0) {
                                  return true;
                                }

                                if (!Number.isFinite(value) || value < 0) {
                                  return "Debes introducir una tasa válida.";
                                }

                                return true;
                              },
                              setValueAs: (value) =>
                                value === "" ? undefined : Number(value),
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {debtsFieldArray.fields.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border bg-secondary/20 p-5 text-sm leading-7 text-muted">
                    Agrega al menos una deuda para poder estimar tu fecha de salida.
                  </div>
                ) : null}

                <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4 text-sm leading-7 text-muted">
                  Después podrás agregar fecha de corte y fecha de pago para activar <span className="font-semibold text-foreground">Siempre a tiempo</span> sin fricción.
                </div>
              </div>
            </section>
          ) : null}

          {currentStep === 4 ? (
            <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft sm:p-8">
              <div className="space-y-3">
                <Label htmlFor="monthlyDebtBudget">Monto mensual disponible (RD$)</Label>
                <Input
                  id="monthlyDebtBudget"
                  type="number"
                  inputMode="decimal"
                  placeholder="Ej: 18,000"
                  {...form.register("monthlyDebtBudget", {
                    required: "Debes indicar cuánto puedes pagar al mes.",
                    validate: (value) => {
                      if (!Number.isFinite(value)) {
                        return "Debes introducir un monto válido.";
                      }

                      if (value <= 0) {
                        return "Debes introducir un monto mayor que cero.";
                      }

                      if (value > 999_999_999) {
                        return "El monto es demasiado alto.";
                      }

                      return true;
                    },
                    setValueAs: (value) =>
                      value === "" ? Number.NaN : Number(value),
                  })}
                />
                <p className="text-sm text-muted">
                  Puedes empezar con el mínimo y luego ajustar.
                </p>
                <div className="rounded-[1.5rem] border border-primary/12 bg-[rgba(240,248,245,0.88)] p-4">
                  <p className="text-sm font-medium text-foreground">
                    Mínimo sugerido ahora mismo: {formatCurrency(minimumSuggestedBudget)}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Si te mantienes al día con al menos ese monto, ya podemos proponerte una ruta inicial.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      form.setValue("monthlyDebtBudget", minimumSuggestedBudget, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    Usar mínimo sugerido
                  </Button>
                </div>
                <p className="text-sm text-rose-600">
                  {form.formState.errors.monthlyDebtBudget?.message}
                </p>
              </div>
            </section>
          ) : null}

          {currentStep === 5 ? (
            <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft sm:p-8">
              {isLoadingPreview ? (
                <div className="grid gap-4">
                  <div className="h-6 w-48 animate-pulse rounded-full bg-secondary" />
                  <div className="h-28 animate-pulse rounded-[1.5rem] bg-secondary" />
                  <div className="h-24 animate-pulse rounded-[1.5rem] bg-secondary" />
                </div>
              ) : preview ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.75rem] border border-primary/12 bg-[linear-gradient(160deg,rgba(12,88,74,0.98),rgba(33,132,113,0.92))] p-5 text-white">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">
                      Resultado inicial
                    </p>
                    <p className="mt-3 text-sm text-white/80">Sales en:</p>
                    <p className="mt-2 font-display text-[clamp(1.9rem,4vw,2.7rem)] tracking-tight">
                      {preview.estimatedDebtFreeDate
                        ? formatDate(preview.estimatedDebtFreeDate, "MMMM yyyy")
                        : "Sin proyección clara"}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/82">
                      {preview.monthsToDebtFree !== null
                        ? `Si te mantienes en este ritmo, saldrías de deudas en ${preview.monthsToDebtFree} meses.`
                        : "Todavía faltan datos para una fecha exacta, pero ya tenemos una prioridad clara."}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-[1.5rem] border border-border bg-secondary/30 p-5">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        Ahorro potencial
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {formatCurrency(preview.potentialSavings)}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-border bg-secondary/30 p-5">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        Plan recomendado
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {preview.recommendedStrategyLabel}
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-border bg-secondary/30 p-5">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted">
                        Prioridad
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {preview.priorityDebtName ?? "Tu deuda más costosa"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-primary/12 bg-[rgba(240,248,245,0.88)] p-5">
                    <p className="text-sm font-semibold text-foreground">
                      {preview.monthsSaved && preview.monthsSaved > 0
                        ? `Podrías ahorrar ${formatCurrency(preview.potentialSavings)} y salir ${preview.monthsSaved} ${preview.monthsSaved === 1 ? "mes" : "meses"} antes.`
                        : `Podrías ahorrar ${formatCurrency(preview.potentialSavings)} si sostienes este plan.`}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      {preview.immediateAction}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      Si mantienes este ritmo, reduces intereses y sales más rápido.
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4 text-sm leading-7 text-muted">
                    <span className="font-semibold text-foreground">Siempre a tiempo:</span> después de entrar podrás registrar fechas de corte y pago para recibir recordatorios por correo antes de cada fecha importante.
                  </div>

                  <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4 text-sm leading-7 text-muted">
                    Optimiza tu plan y ahorra más con Premium.
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {stepError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {stepError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={currentStep === 1 || isSubmitting || isLoadingPreview}
              onClick={() => {
                setStepError(null);
                setCurrentStep((step) => Math.max(1, step - 1));
              }}
            >
              <ArrowLeft className="mr-2 size-4" />
              Atrás
            </Button>

            {currentStep < totalSteps ? (
              <Button
                type="button"
                disabled={isLoadingPreview}
                onClick={goToNextStep}
              >
                {currentStep === 1 ? "Empezar" : "Continuar"}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting || isLoadingPreview}>
                Ver mi plan completo
                <ArrowRight className="ml-2 size-4" />
              </Button>
            )}
          </div>
        </div>

        <aside className="grid gap-6">
          <section className="rounded-[2rem] border border-primary/12 bg-[rgba(240,248,245,0.9)] p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-primary">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Confianza desde el inicio</p>
                <ul className="mt-3 grid gap-2 text-sm leading-7 text-muted">
                  {ONBOARDING_TRUST_COPY.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Resumen rápido
            </p>
            <div className="mt-4 grid gap-4">
              <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Ingreso mensual
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {Number.isFinite(form.getValues("monthlyIncome"))
                    ? formatCurrency(Number(form.getValues("monthlyIncome")))
                    : "Pendiente"}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Deudas cargadas
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {watchedDebts.length} / {ONBOARDING_MAX_DEBTS}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border bg-secondary/20 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Presupuesto mensual
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {Number.isFinite(Number(watchedBudget))
                    ? formatCurrency(Number(watchedBudget))
                    : "Pendiente"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-white p-6 shadow-soft">
            <p className="text-sm font-semibold text-foreground">
              Enlaces legales
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Antes de usar tu panel completo, mantén a mano los documentos clave.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-primary">
              <Link href="/terms">Términos y Condiciones</Link>
              <Link href="/privacy">Política de Privacidad</Link>
            </div>
          </section>
        </aside>
      </form>
    </div>
  );
}
