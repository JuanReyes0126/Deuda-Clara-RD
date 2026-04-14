"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  REMINDER_DAY_OPTIONS,
  REMINDER_HOUR_OPTIONS,
  REMINDER_SLOGAN,
} from "@/config/reminders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils/currency";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { buildMonthlyCashflowSnapshot } from "@/lib/finance/monthly-cashflow";
import { resolveFeatureAccess } from "@/lib/feature-access";
import { sanitizeText } from "@/lib/security/sanitize";
import type { PasskeyPublicDto, UserSettingsViewModelDto } from "@/lib/types/app";

type SettingsPanelProps = {
  user: UserSettingsViewModelDto;
  securityNotice?: string | null;
};

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  avatarUrl: string | undefined;
};

type PreferencesFormValues = {
  defaultCurrency: "DOP" | "USD";
  preferredStrategy: "SNOWBALL" | "AVALANCHE" | "HYBRID";
  hybridRateWeight: number;
  hybridBalanceWeight: number;
  monthlyIncome: number;
  monthlyHousingCost: number;
  monthlyGroceriesCost: number;
  monthlyUtilitiesCost: number;
  monthlyTransportCost: number;
  monthlyOtherEssentialExpenses: number;
  monthlyDebtBudget: number;
  notifyDueSoon: boolean;
  notifyOverdue: boolean;
  notifyMinimumRisk: boolean;
  notifyMonthlyReport: boolean;
  emailRemindersEnabled: boolean;
  preferredReminderDays: number[];
  preferredReminderHour: number;
  upcomingDueDays: number;
  timezone: string;
  language: "es" | "en";
};

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type MfaDisableFormValues = {
  currentPassword: string;
  totpCode: string;
};

type TotpSetupPayload = {
  setupKey: string;
  provisioningUri: string;
};

type RecoveryCodesPayload = {
  backupCodes: string[];
};

type ReauthFormValues = {
  currentPassword: string;
  totpCode: string;
  recoveryCode: string;
};

const passkeyDateFormatter = new Intl.DateTimeFormat("es-DO", {
  dateStyle: "medium",
});

function formatPasskeyTimestamp(value: string | null) {
  if (!value) {
    return "Aún sin uso";
  }

  return passkeyDateFormatter.format(new Date(value));
}

const strategyOptions = new Set<PreferencesFormValues["preferredStrategy"]>([
  "SNOWBALL",
  "AVALANCHE",
  "HYBRID",
]);

function buildTextValidation(maxLength: number) {
  return {
    validate: (value: string) => {
      const cleanValue = sanitizeText(value);

      if (cleanValue.length < 1) {
        return "Este campo es obligatorio.";
      }

      if (cleanValue.length > maxLength) {
        return "El texto es demasiado largo.";
      }

      return true;
    },
    setValueAs: (value: string) => sanitizeText(value),
  } as const;
}

function getLanguageValue(
  language:
    | NonNullable<UserSettingsViewModelDto["settings"]>["language"]
    | undefined,
): PreferencesFormValues["language"] {
  return language === "en" ? "en" : "es";
}

const firstNameValidation = buildTextValidation(80);
const lastNameValidation = buildTextValidation(80);
const timezoneValidation = buildTextValidation(80);

const avatarUrlValidation = {
  validate: (value: string | undefined) => {
    if (!value) {
      return true;
    }

    try {
      new URL(value);
      return true;
    } catch {
      return "URL inválida.";
    }
  },
  setValueAs: (value: string) => {
    const cleanValue = sanitizeText(value);
    return cleanValue.length ? cleanValue : undefined;
  },
} as const;

function buildIntegerPercentValidation() {
  return {
    validate: (value: number) => {
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        return "Debe ser un porcentaje válido.";
      }

      return true;
    },
    setValueAs: (value: string) => (value === "" ? Number.NaN : Number(value)),
  } as const;
}

const hybridRateWeightValidation = buildIntegerPercentValidation();

const monthlyDebtBudgetValidation = {
  validate: (value: number) => {
    if (!Number.isFinite(value)) {
      return "Debes introducir un monto válido.";
    }

    if (value < 0) {
      return "El monto no puede ser negativo.";
    }

    if (value > 999_999_999) {
      return "El monto es demasiado alto.";
    }

    return true;
  },
  setValueAs: (value: string) => (value === "" ? Number.NaN : Number(value)),
} as const;

const upcomingDueDaysValidation = {
  validate: (value: number) => {
    if (!Number.isInteger(value) || value < 1) {
      return "Debes elegir al menos 1 día.";
    }

    if (value > 30) {
      return "El valor máximo es 30 días.";
    }

    return true;
  },
  setValueAs: (value: string) => (value === "" ? Number.NaN : Number(value)),
} as const;

const preferredReminderHourValidation = {
  validate: (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      return "Debes elegir una hora válida.";
    }

    return true;
  },
  setValueAs: (value: string) => (value === "" ? Number.NaN : Number(value)),
} as const;

const passwordValidation = {
  validate: (value: string) => {
    if (value.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres.";
    }

    if (value.length > 72) {
      return "La contraseña no puede exceder 72 caracteres.";
    }

    if (!/[A-Z]/.test(value)) {
      return "La contraseña debe incluir al menos una mayúscula.";
    }

    if (!/[a-z]/.test(value)) {
      return "La contraseña debe incluir al menos una minúscula.";
    }

    if (!/\d/.test(value)) {
      return "La contraseña debe incluir al menos un número.";
    }

    return true;
  },
} as const;

const totpCodeValidation = {
  required: "El código de verificación es obligatorio.",
  pattern: {
    value: /^\d{6}$/,
    message: "El código debe tener 6 dígitos.",
  },
  setValueAs: (value: string) => sanitizeText(value),
} as const;

async function requestJson<TPayload = { error?: string }>(
  url: string,
  method: "DELETE" | "PATCH" | "POST",
  body: unknown,
) {
  const response = await fetchWithCsrf(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as TPayload & {
    error?: string;
    reauthRequired?: boolean;
  };

  if (!response.ok) {
    const error = new Error(payload.error ?? "No se pudo guardar.") as Error & {
      reauthRequired?: boolean;
    };
    error.reauthRequired = Boolean(payload.reauthRequired);
    throw error;
  }

  return payload;
}

export function SettingsPanel({ user, securityNotice = null }: SettingsPanelProps) {
  const router = useRouter();
  const profileForm = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  });
  const preferencesForm = useForm<PreferencesFormValues>({
    defaultValues: {
      defaultCurrency: user.settings?.defaultCurrency ?? "DOP",
      preferredStrategy: user.settings?.preferredStrategy ?? "AVALANCHE",
      hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
      hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
      monthlyIncome: Number(user.settings?.monthlyIncome ?? 0),
      monthlyHousingCost: Number(user.settings?.monthlyHousingCost ?? 0),
      monthlyGroceriesCost: Number(user.settings?.monthlyGroceriesCost ?? 0),
      monthlyUtilitiesCost: Number(user.settings?.monthlyUtilitiesCost ?? 0),
      monthlyTransportCost: Number(user.settings?.monthlyTransportCost ?? 0),
      monthlyOtherEssentialExpenses: Number(
        user.settings?.monthlyOtherEssentialExpenses ?? 0,
      ),
      monthlyDebtBudget: Number(user.settings?.monthlyDebtBudget ?? 0),
      notifyDueSoon: user.settings?.notifyDueSoon ?? true,
      notifyOverdue: user.settings?.notifyOverdue ?? true,
      notifyMinimumRisk: user.settings?.notifyMinimumRisk ?? true,
      notifyMonthlyReport: user.settings?.notifyMonthlyReport ?? true,
      emailRemindersEnabled: user.settings?.emailRemindersEnabled ?? false,
      preferredReminderDays: user.settings?.preferredReminderDays ?? [5, 2, 0],
      preferredReminderHour: user.settings?.preferredReminderHour ?? 8,
      upcomingDueDays: user.settings?.upcomingDueDays ?? 3,
      timezone: user.settings?.timezone ?? user.timezone,
      language: getLanguageValue(user.settings?.language),
    },
  });
  const watchedEmailReminders = useWatch({
    control: preferencesForm.control,
    name: "emailRemindersEnabled",
  });
  const watchedMonthlyIncome = useWatch({
    control: preferencesForm.control,
    name: "monthlyIncome",
  });
  const watchedMonthlyHousingCost = useWatch({
    control: preferencesForm.control,
    name: "monthlyHousingCost",
  });
  const watchedMonthlyGroceriesCost = useWatch({
    control: preferencesForm.control,
    name: "monthlyGroceriesCost",
  });
  const watchedMonthlyUtilitiesCost = useWatch({
    control: preferencesForm.control,
    name: "monthlyUtilitiesCost",
  });
  const watchedMonthlyTransportCost = useWatch({
    control: preferencesForm.control,
    name: "monthlyTransportCost",
  });
  const watchedMonthlyOtherEssentialExpenses = useWatch({
    control: preferencesForm.control,
    name: "monthlyOtherEssentialExpenses",
  });
  const watchedDefaultCurrency = useWatch({
    control: preferencesForm.control,
    name: "defaultCurrency",
  }) ?? "DOP";
  const featureAccess = resolveFeatureAccess({
    membershipTier: user.settings?.membershipTier ?? "FREE",
    membershipBillingStatus: user.settings?.membershipBillingStatus ?? "FREE",
  });
  const advancedReminderDays = new Set(featureAccess.allowedReminderDays);
  const upgradeHref = `/planes?plan=${featureAccess.upgradeTargetTier}&source=configuracion`;
  const hasPremiumGuidance =
    user.settings?.membershipBillingStatus === "ACTIVE" && user.settings?.membershipTier !== "FREE";
  const [isTotpWorking, setIsTotpWorking] = useState(false);
  const [isPasskeySupported, setIsPasskeySupported] = useState(false);
  const [isPasskeyWorking, setIsPasskeyWorking] = useState(false);
  const [mfaTotpEnabled, setMfaTotpEnabled] = useState(
    user.settings?.mfaTotpEnabled ?? false,
  );
  const [mfaRecoveryCodesRemaining, setMfaRecoveryCodesRemaining] = useState(
    user.settings?.mfaRecoveryCodesRemaining ?? 0,
  );
  const [passkeys, setPasskeys] = useState<PasskeyPublicDto[]>(user.passkeys ?? []);
  const [showReauthCard, setShowReauthCard] = useState(false);
  const [isReauthSubmitting, setIsReauthSubmitting] = useState(false);
  const [reauthValues, setReauthValues] = useState<ReauthFormValues>({
    currentPassword: "",
    totpCode: "",
    recoveryCode: "",
  });
  const [pendingSensitiveAction, setPendingSensitiveAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const [totpSetup, setTotpSetup] = useState<TotpSetupPayload | null>(null);
  const [totpSetupCode, setTotpSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const watchedPreferredReminderDays = useWatch({
    control: preferencesForm.control,
    name: "preferredReminderDays",
  }) ?? [];
  const watchedPreferredReminderHour = useWatch({
    control: preferencesForm.control,
    name: "preferredReminderHour",
  });
  const watchedMonthlyDebtBudget = useWatch({
    control: preferencesForm.control,
    name: "monthlyDebtBudget",
  });
  const financialSnapshot = useMemo(
    () =>
      buildMonthlyCashflowSnapshot({
        monthlyIncome: watchedMonthlyIncome,
        monthlyHousingCost: watchedMonthlyHousingCost,
        monthlyGroceriesCost: watchedMonthlyGroceriesCost,
        monthlyUtilitiesCost: watchedMonthlyUtilitiesCost,
        monthlyTransportCost: watchedMonthlyTransportCost,
        monthlyOtherEssentialExpenses: watchedMonthlyOtherEssentialExpenses,
      }),
    [
      watchedMonthlyGroceriesCost,
      watchedMonthlyHousingCost,
      watchedMonthlyIncome,
      watchedMonthlyOtherEssentialExpenses,
      watchedMonthlyTransportCost,
      watchedMonthlyUtilitiesCost,
    ],
  );
  const reminderDayLabels = REMINDER_DAY_OPTIONS.filter((option) =>
    watchedPreferredReminderDays.includes(option.value),
  ).map((option) => option.label);
  const reminderHourLabel =
    REMINDER_HOUR_OPTIONS.find((option) => option.value === watchedPreferredReminderHour)
      ?.label ?? "8:00 AM";
  const reminderChannelLabel = watchedEmailReminders ? "Correo + app" : "Solo dentro de la app";
  const passwordForm = useForm<ChangePasswordFormValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const mfaDisableForm = useForm<MfaDisableFormValues>({
    defaultValues: {
      currentPassword: "",
      totpCode: "",
    },
  });
  const recoveryCodesForm = useForm<Pick<MfaDisableFormValues, "currentPassword">>({
    defaultValues: {
      currentPassword: "",
    },
  });

  useEffect(() => {
    setIsPasskeySupported(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  const handleSensitiveActionError = (
    error: unknown,
    retryAction: () => Promise<void>,
  ) => {
    if (
      error instanceof Error &&
      "reauthRequired" in error &&
      (error as Error & { reauthRequired?: boolean }).reauthRequired
    ) {
      setPendingSensitiveAction(() => retryAction);
      setShowReauthCard(true);
      toast.message("Confirma tu identidad para continuar.");
      return true;
    }

    return false;
  };

  const runPendingSensitiveAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      if (handleSensitiveActionError(error, action)) {
        return;
      }

      throw error;
    }
  };

  const confirmRecentAuth = async () => {
    await requestJson("/api/auth/reautenticar", "POST", reauthValues);
    setShowReauthCard(false);
    setReauthValues({
      currentPassword: "",
      totpCode: "",
      recoveryCode: "",
    });
    toast.success("Identidad confirmada.");

    if (pendingSensitiveAction) {
      const action = pendingSensitiveAction;
      setPendingSensitiveAction(null);
      await runPendingSensitiveAction(action);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {securityNotice ? (
        <Card className="border-amber-200 bg-amber-50/80 p-6">
          <CardHeader>
            <CardTitle>Acción de seguridad requerida</CardTitle>
            <CardDescription>{securityNotice}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {showReauthCard ? (
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Confirma tu identidad</CardTitle>
            <CardDescription>
              Antes de cambiar seguridad de la cuenta, verifica que sigues siendo tú.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="reauthSettingsPassword">Contraseña actual</Label>
              <Input
                id="reauthSettingsPassword"
                type="password"
                autoComplete="current-password"
                value={reauthValues.currentPassword}
                onChange={(event) =>
                  setReauthValues((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reauthSettingsTotp">Código de verificación</Label>
              <Input
                id="reauthSettingsTotp"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                value={reauthValues.totpCode}
                onChange={(event) =>
                  setReauthValues((current) => ({
                    ...current,
                    totpCode: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reauthSettingsRecovery">Código de respaldo</Label>
              <Input
                id="reauthSettingsRecovery"
                type="text"
                autoCapitalize="characters"
                maxLength={20}
                placeholder="ABCDE-12345"
                value={reauthValues.recoveryCode}
                onChange={(event) =>
                  setReauthValues((current) => ({
                    ...current,
                    recoveryCode: event.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div className="lg:col-span-3 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={async () => {
                  try {
                    setIsReauthSubmitting(true);
                    await confirmRecentAuth();
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "No se pudo confirmar tu identidad.",
                    );
                  } finally {
                    setIsReauthSubmitting(false);
                  }
                }}
                disabled={isReauthSubmitting}
              >
                {isReauthSubmitting ? "Confirmando..." : "Confirmar identidad"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowReauthCard(false);
                  setPendingSensitiveAction(null);
                }}
                disabled={isReauthSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            Datos básicos de la cuenta y presentación personal.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={profileForm.handleSubmit(async (values) => {
              try {
                await requestJson("/api/settings/profile", "PATCH", values);
                toast.success("Perfil actualizado.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                {...profileForm.register("firstName", firstNameValidation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                {...profileForm.register("lastName", lastNameValidation)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                {...profileForm.register("avatarUrl", avatarUrlValidation)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Guardar perfil</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Verificación en dos pasos</CardTitle>
          <CardDescription>
            Añade un código temporal de 6 dígitos para proteger el acceso a tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="rounded-[1.5rem] border border-primary/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,138,93,0.08))] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Estado MFA
            </p>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {mfaTotpEnabled ? "Activo con app autenticadora" : "Aún no activado"}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              {mfaTotpEnabled
                ? "Al iniciar sesión, además de tu contraseña, te pediremos un código temporal de tu app autenticadora."
                : "Puedes conectarlo con Google Authenticator, 1Password, Authy o cualquier app compatible con TOTP."}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Códigos de respaldo disponibles: {mfaRecoveryCodesRemaining}
            </p>
          </div>

          {!mfaTotpEnabled ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      const action = async () => {
                        setIsTotpWorking(true);
                        const payload = await requestJson<{
                          setup: TotpSetupPayload;
                        }>("/api/settings/mfa/totp", "POST", {});
                        setTotpSetup(payload.setup);
                        setTotpSetupCode("");
                        toast.success("Clave TOTP generada. Confirma el código para activarla.");
                      };
                      await runPendingSensitiveAction(action);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "No se pudo preparar MFA.",
                      );
                    } finally {
                      setIsTotpWorking(false);
                    }
                  }}
                  disabled={isTotpWorking}
                >
                  {totpSetup ? "Generar nueva clave" : "Generar clave TOTP"}
                </Button>
              </div>

              {totpSetup ? (
                <div className="grid gap-4 rounded-[1.75rem] border border-border bg-white/88 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="totpSetupKey">Clave manual</Label>
                      <Input id="totpSetupKey" value={totpSetup.setupKey} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totpProvisioningUri">URI de configuración</Label>
                      <Input
                        id="totpProvisioningUri"
                        value={totpSetup.provisioningUri}
                        readOnly
                      />
                    </div>
                    <p className="text-sm leading-7 text-muted">
                      Abre tu app autenticadora, agrega una cuenta nueva con esa clave y luego confirma el código de 6 dígitos.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="totpSetupCode">Código de 6 dígitos</Label>
                      <Input
                        id="totpSetupCode"
                        value={totpSetupCode}
                        onChange={(event) =>
                          setTotpSetupCode(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        maxLength={6}
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={async () => {
                        if (!/^\d{6}$/.test(totpSetupCode)) {
                          toast.error("El código debe tener 6 dígitos.");
                          return;
                        }

                        try {
                          const action = async () => {
                            setIsTotpWorking(true);
                            const payload = await requestJson<{
                              mfa: {
                                mfaTotpEnabled: boolean;
                                backupCodes: string[];
                              };
                            }>("/api/settings/mfa/totp", "PATCH", {
                              totpCode: totpSetupCode,
                            });
                            setMfaTotpEnabled(true);
                            setMfaRecoveryCodesRemaining(
                              payload.mfa.backupCodes.length,
                            );
                            setRecoveryCodes(payload.mfa.backupCodes);
                            setTotpSetup(null);
                            setTotpSetupCode("");
                            toast.success("Verificación en dos pasos activada.");
                          };
                          await runPendingSensitiveAction(action);
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "No se pudo activar MFA.",
                          );
                        } finally {
                          setIsTotpWorking(false);
                        }
                      }}
                      disabled={isTotpWorking}
                    >
                      Confirmar activación
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {recoveryCodes ? (
                <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">
                    Guarda estos códigos ahora
                  </p>
                  <p className="mt-2 text-sm leading-7 text-amber-900/80">
                    Cada código sirve una sola vez. Si pierdes tu app autenticadora, podrás entrar con uno de estos.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {recoveryCodes.map((code) => (
                      <div
                        key={code}
                        className="rounded-2xl border border-amber-200 bg-white px-4 py-3 font-mono text-sm font-semibold tracking-[0.12em] text-foreground"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <form
                className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={recoveryCodesForm.handleSubmit(async (values) => {
                  try {
                    const action = async () => {
                      setIsTotpWorking(true);
                      const payload = await requestJson<{
                        recovery: RecoveryCodesPayload;
                      }>("/api/settings/mfa/totp", "POST", {
                        action: "regenerate-recovery-codes",
                        ...values,
                      });
                      setRecoveryCodes(payload.recovery.backupCodes);
                      setMfaRecoveryCodesRemaining(
                        payload.recovery.backupCodes.length,
                      );
                      recoveryCodesForm.reset();
                      toast.success("Códigos de respaldo regenerados.");
                    };
                    await runPendingSensitiveAction(action);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "No se pudieron regenerar los códigos.",
                    );
                  } finally {
                    setIsTotpWorking(false);
                  }
                })}
              >
                <div className="space-y-2">
                  <Label htmlFor="mfaRecoveryPassword">Contraseña actual</Label>
                  <Input
                    id="mfaRecoveryPassword"
                    type="password"
                    autoComplete="current-password"
                    {...recoveryCodesForm.register("currentPassword", {
                      required: "La contraseña actual es obligatoria.",
                    })}
                  />
                  <p className="text-sm text-rose-600">
                    {recoveryCodesForm.formState.errors.currentPassword?.message}
                  </p>
                </div>

                <div className="flex items-end">
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={isTotpWorking}
                  >
                    Regenerar códigos
                  </Button>
                </div>
              </form>

              <form
                className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                onSubmit={mfaDisableForm.handleSubmit(async (values) => {
                  try {
                    const action = async () => {
                      setIsTotpWorking(true);
                      await requestJson("/api/settings/mfa/totp", "DELETE", values);
                      setMfaTotpEnabled(false);
                      setMfaRecoveryCodesRemaining(0);
                      setRecoveryCodes(null);
                      setTotpSetup(null);
                      setTotpSetupCode("");
                      mfaDisableForm.reset();
                      toast.success("Verificación en dos pasos desactivada.");
                    };
                    await runPendingSensitiveAction(action);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "No se pudo desactivar MFA.",
                    );
                  } finally {
                    setIsTotpWorking(false);
                  }
                })}
              >
                <div className="space-y-2">
                  <Label htmlFor="mfaCurrentPassword">Contraseña actual</Label>
                  <Input
                    id="mfaCurrentPassword"
                    type="password"
                    autoComplete="current-password"
                    {...mfaDisableForm.register("currentPassword", {
                      required: "La contraseña actual es obligatoria.",
                    })}
                  />
                  <p className="text-sm text-rose-600">
                    {mfaDisableForm.formState.errors.currentPassword?.message}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mfaDisableCode">Código actual</Label>
                  <Input
                    id="mfaDisableCode"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    {...mfaDisableForm.register("totpCode", totpCodeValidation)}
                  />
                  <p className="text-sm text-rose-600">
                    {mfaDisableForm.formState.errors.totpCode?.message}
                  </p>
                </div>

                <div className="flex items-end">
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={isTotpWorking}
                  >
                    Desactivar MFA
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Usa Face ID, Touch ID, Windows Hello o la passkey de tu gestor para entrar sin depender solo de la contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="rounded-[1.5rem] border border-primary/12 bg-[linear-gradient(135deg,rgba(15,118,110,0.08),rgba(240,138,93,0.08))] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Estado passkeys
            </p>
            <p className="mt-3 text-2xl font-semibold text-foreground">
              {passkeys.length > 0
                ? `${passkeys.length} dispositivo${passkeys.length === 1 ? "" : "s"} protegido${passkeys.length === 1 ? "" : "s"}`
                : "Aún no registras ninguna"}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Registrarlas te da un acceso más resistente a phishing y reduce la dependencia de contraseñas.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              disabled={!isPasskeySupported || isPasskeyWorking}
              onClick={async () => {
                try {
                  const action = async () => {
                    setIsPasskeyWorking(true);
                    const optionsPayload = await requestJson<{
                      options: import("@simplewebauthn/browser").PublicKeyCredentialCreationOptionsJSON;
                    }>("/api/settings/passkeys/options", "POST", {});
                    const { startRegistration } = await import("@simplewebauthn/browser");
                    const credential = await startRegistration({
                      optionsJSON: optionsPayload.options,
                    });
                    const verifyPayload = await requestJson<{
                      passkey: PasskeyPublicDto | null;
                      passkeys: PasskeyPublicDto[];
                    }>("/api/settings/passkeys/verify", "POST", {
                      credential,
                    });
                    setPasskeys(verifyPayload.passkeys);
                    toast.success("Passkey agregada.");
                  };
                  await runPendingSensitiveAction(action);
                } catch (error) {
                  const message =
                    error instanceof Error &&
                    /cancel|abort|not allowed/i.test(error.message)
                      ? "Se canceló el registro de la passkey."
                      : error instanceof Error
                        ? error.message
                        : "No se pudo registrar la passkey.";
                  toast.error(message);
                } finally {
                  setIsPasskeyWorking(false);
                }
              }}
            >
              {isPasskeyWorking ? "Registrando..." : "Registrar este dispositivo"}
            </Button>

            <p className="text-sm leading-7 text-muted">
              {isPasskeySupported
                ? "Este navegador soporta WebAuthn y puede registrar una passkey segura."
                : "Este navegador o dispositivo no expone soporte para passkeys ahora mismo."}
            </p>
          </div>

          {passkeys.length > 0 ? (
            <div className="space-y-3">
              {passkeys.map((passkey, index) => (
                <div
                  key={passkey.id}
                  className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-white/88 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {passkey.name ?? `Passkey ${index + 1}`}
                    </p>
                    <p className="text-sm text-muted">
                      {passkey.deviceType === "multiDevice"
                        ? "Sincronizable entre dispositivos"
                        : "Vinculada a un solo dispositivo"}
                    </p>
                    <p className="text-sm text-muted">
                      {passkey.backedUp ? "Con respaldo detectado" : "Sin respaldo detectado"}
                    </p>
                    <p className="text-sm text-muted">
                      Último uso: {formatPasskeyTimestamp(passkey.lastUsedAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isPasskeyWorking}
                    onClick={async () => {
                      try {
                        const action = async () => {
                          setIsPasskeyWorking(true);
                          const payload = await requestJson<{
                            passkeys: PasskeyPublicDto[];
                          }>(`/api/settings/passkeys/${passkey.id}`, "DELETE", {});
                          setPasskeys(payload.passkeys);
                          toast.success("Passkey eliminada.");
                        };
                        await runPendingSensitiveAction(action);
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "No se pudo eliminar la passkey.",
                        );
                      } finally {
                        setIsPasskeyWorking(false);
                      }
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-white/72 px-4 py-5 text-sm leading-7 text-muted">
              Cuando registres una passkey, aquí verás cada dispositivo autorizado para entrar a tu cuenta.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
          <CardDescription>
            Moneda, estrategia, alertas y zona horaria.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={preferencesForm.handleSubmit(async (values) => {
              try {
                await requestJson("/api/settings/preferences", "PATCH", values);
                toast.success("Preferencias actualizadas.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
              }
            })}
          >
            <div className="rounded-[1.75rem] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(240,248,245,0.9)_100%)] p-5 md:col-span-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                    {REMINDER_SLOGAN}
                  </p>
                  <p className="mt-3 text-xl font-semibold text-foreground">{reminderChannelLabel}</p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    {watchedEmailReminders
                      ? `Te avisaremos antes de tus fechas importantes. ${reminderDayLabels.join(", ")} a las ${reminderHourLabel}.`
                      : "Activa el correo y te avisaremos antes del corte y antes del pago para que no se te pase nada."}
                  </p>
                  {!featureAccess.canUseAdvancedReminders ? (
                    <p className="mt-3 text-sm leading-7 text-primary">
                      Base mantiene aviso de 2 días antes y el mismo día. Premium añade el aviso de 5 días y alertas más completas.
                    </p>
                  ) : null}
                  {hasPremiumGuidance ? (
                    <p className="mt-3 text-sm leading-7 text-primary">
                      Como tienes un plan premium activo, el sistema también puede empujarte un seguimiento semanal con la deuda foco y el ritmo sugerido.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      preferencesForm.setValue("notifyDueSoon", true);
                      preferencesForm.setValue("notifyOverdue", true);
                      preferencesForm.setValue("notifyMinimumRisk", false);
                      preferencesForm.setValue("notifyMonthlyReport", false);
                      preferencesForm.setValue("emailRemindersEnabled", false);
                      preferencesForm.setValue("preferredReminderDays", [2, 0]);
                      preferencesForm.setValue("preferredReminderHour", 8);
                    }}
                  >
                    Modo básico
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (!featureAccess.canReceiveAdvancedAlerts) {
                        router.push(upgradeHref as never);
                        return;
                      }

                      preferencesForm.setValue("notifyDueSoon", true);
                      preferencesForm.setValue("notifyOverdue", true);
                      preferencesForm.setValue("notifyMinimumRisk", true);
                      preferencesForm.setValue("notifyMonthlyReport", true);
                      preferencesForm.setValue("emailRemindersEnabled", true);
                      preferencesForm.setValue("preferredReminderDays", [5, 2, 0]);
                      preferencesForm.setValue("preferredReminderHour", 8);
                    }}
                  >
                    {featureAccess.canReceiveAdvancedAlerts
                      ? "Modo completo"
                      : "Desbloquear alertas completas"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Canal</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{reminderChannelLabel}</p>
                </div>
                <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Avisos por correo</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {reminderDayLabels.length ? reminderDayLabels.join(", ") : "Sin aviso"}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Hora preferida</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {reminderHourLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-primary/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(240,248,245,0.9)_100%)] p-5 md:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                Contexto financiero
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Registra cuánto ganas y cuánto se te va en gastos base. Así el presupuesto de deudas y el simulador parten de una realidad más clara.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Ingreso mensual</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatCurrency(
                      financialSnapshot.monthlyIncome ?? 0,
                      watchedDefaultCurrency,
                    )}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Gastos base</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatCurrency(
                      financialSnapshot.monthlyEssentialExpensesTotal ?? 0,
                      watchedDefaultCurrency,
                    )}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Capacidad de deudas</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatCurrency(
                      financialSnapshot.monthlyDebtCapacity ?? 0,
                      watchedDefaultCurrency,
                    )}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/85 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Presupuesto actual</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatCurrency(
                      watchedMonthlyDebtBudget ?? 0,
                      watchedDefaultCurrency,
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyIncome">Ingreso mensual</Label>
              <Input
                id="monthlyIncome"
                type="number"
                step="0.01"
                {...preferencesForm.register("monthlyIncome", monthlyDebtBudgetValidation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyHousingCost">Vivienda / renta</Label>
              <Input
                id="monthlyHousingCost"
                type="number"
                step="0.01"
                {...preferencesForm.register("monthlyHousingCost", monthlyDebtBudgetValidation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyGroceriesCost">Compras / comida</Label>
              <Input
                id="monthlyGroceriesCost"
                type="number"
                step="0.01"
                {...preferencesForm.register(
                  "monthlyGroceriesCost",
                  monthlyDebtBudgetValidation,
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyUtilitiesCost">Agua, luz e internet</Label>
              <Input
                id="monthlyUtilitiesCost"
                type="number"
                step="0.01"
                {...preferencesForm.register(
                  "monthlyUtilitiesCost",
                  monthlyDebtBudgetValidation,
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyTransportCost">Vehículo / transporte</Label>
              <Input
                id="monthlyTransportCost"
                type="number"
                step="0.01"
                {...preferencesForm.register(
                  "monthlyTransportCost",
                  monthlyDebtBudgetValidation,
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyOtherEssentialExpenses">Otros gastos base</Label>
              <Input
                id="monthlyOtherEssentialExpenses"
                type="number"
                step="0.01"
                {...preferencesForm.register(
                  "monthlyOtherEssentialExpenses",
                  monthlyDebtBudgetValidation,
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Moneda</Label>
              <select
                id="defaultCurrency"
                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                {...preferencesForm.register("defaultCurrency", {
                  validate: (value) => value === "DOP" || value === "USD",
                })}
              >
                <option value="DOP">RD$</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferredStrategy">Método preferido</Label>
              <select
                id="preferredStrategy"
                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                {...preferencesForm.register("preferredStrategy", {
                  validate: (value) => strategyOptions.has(value),
                })}
              >
                <option value="AVALANCHE">Avalanche</option>
                <option value="SNOWBALL">Snowball</option>
                <option value="HYBRID">Híbrido</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hybridRateWeight">Peso tasa híbrida</Label>
              <Input
                id="hybridRateWeight"
                type="number"
                {...preferencesForm.register(
                  "hybridRateWeight",
                  hybridRateWeightValidation,
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hybridBalanceWeight">Peso saldo híbrido</Label>
              <Input
                id="hybridBalanceWeight"
                type="number"
                {...preferencesForm.register("hybridBalanceWeight", {
                  validate: (value, formValues) => {
                    if (!Number.isInteger(value) || value < 0 || value > 100) {
                      return "Debe ser un porcentaje válido.";
                    }

                    if (
                      (formValues.hybridRateWeight ?? 0) + value !==
                      100
                    ) {
                      return "Los pesos del modo híbrido deben sumar 100.";
                    }

                    return true;
                  },
                  setValueAs: (value: string) =>
                    value === "" ? Number.NaN : Number(value),
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyDebtBudget">Presupuesto mensual</Label>
              <Input
                id="monthlyDebtBudget"
                type="number"
                step="0.01"
                {...preferencesForm.register(
                  "monthlyDebtBudget",
                  monthlyDebtBudgetValidation,
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upcomingDueDays">Días de aviso</Label>
              <Input
                id="upcomingDueDays"
                type="number"
                {...preferencesForm.register(
                  "upcomingDueDays",
                  upcomingDueDaysValidation,
                )}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{REMINDER_SLOGAN}</Label>
              <p className="text-sm text-muted">
                Te avisaremos antes de tus fechas importantes. Elige cuántos días antes quieres recibir el correo.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {REMINDER_DAY_OPTIONS.map((option) => {
                  const selected = watchedPreferredReminderDays.includes(option.value);
                  const isLocked = !advancedReminderDays.has(option.value);

                  return (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4 ${
                        isLocked ? "opacity-70" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-4"
                        disabled={isLocked}
                        checked={selected}
                        onChange={(event) => {
                          if (isLocked) {
                            return;
                          }

                          const currentValues = preferencesForm.getValues("preferredReminderDays") ?? [];
                          const nextValues = event.target.checked
                            ? [...currentValues, option.value]
                            : currentValues.filter((value) => value !== option.value);

                          preferencesForm.setValue(
                            "preferredReminderDays",
                            [...new Set(nextValues)].sort((left, right) => right - left),
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            },
                          );
                        }}
                      />
                      <span className="text-sm text-muted">
                        {option.label}
                        {isLocked ? " · Premium" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="text-sm text-rose-600">
                {preferencesForm.formState.errors.preferredReminderDays?.message}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredReminderHour">Hora del recordatorio</Label>
              <select
                id="preferredReminderHour"
                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                {...preferencesForm.register(
                  "preferredReminderHour",
                  preferredReminderHourValidation,
                )}
              >
                {REMINDER_HOUR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <Input
                id="timezone"
                {...preferencesForm.register("timezone", timezoneValidation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Idioma</Label>
              <select
                id="language"
                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                {...preferencesForm.register("language", {
                  validate: (value) => value === "es" || value === "en",
                })}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>

            {[
              {
                name: "notifyDueSoon",
                label: "Alertas de vencimiento cercano",
                locked: false,
              },
              {
                name: "notifyOverdue",
                label: "Alertas por atraso",
                locked: false,
              },
              {
                name: "notifyMinimumRisk",
                label: "Alertas de riesgo por mínimos",
                locked: !featureAccess.canReceiveAdvancedAlerts,
              },
              {
                name: "notifyMonthlyReport",
                label: "Resumen mensual",
                locked: !featureAccess.canReceiveAdvancedAlerts,
              },
              {
                name: "emailRemindersEnabled",
                label: "Recordatorios por email",
                locked: false,
              },
            ].map(({ name, label, locked }) => (
              <label
                key={name}
                className={`flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4 ${
                  locked ? "opacity-70" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  disabled={Boolean(locked)}
                  {...preferencesForm.register(name as never)}
                />
                <span className="text-sm text-muted">
                  {label}
                  {locked ? " · Premium" : ""}
                </span>
              </label>
            ))}

            <div className="md:col-span-2">
              <Button type="submit">Guardar preferencias</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="p-6">
        <CardHeader>
          <CardTitle>Seguridad</CardTitle>
          <CardDescription>Cambia la contraseña de acceso.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            className="grid gap-4 md:grid-cols-3"
            onSubmit={passwordForm.handleSubmit(async (values) => {
              try {
                const action = async () => {
                  await requestJson("/api/auth/cambiar-contrasena", "POST", values);
                  toast.success("Contraseña actualizada.");
                  passwordForm.reset();
                };
                await runPendingSensitiveAction(action);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register("currentPassword", {
                  required: "La contraseña actual es obligatoria.",
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register("newPassword", passwordValidation)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register("confirmPassword", {
                  validate: (value, formValues) =>
                    value === formValues.newPassword ||
                    "Las contraseñas no coinciden.",
                })}
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Cambiar contraseña</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
