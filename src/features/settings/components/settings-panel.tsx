"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { User, UserSettings } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileSchema, preferencesSchema } from "@/lib/validations/profile";
import { changePasswordSchema } from "@/lib/validations/auth";

type SettingsPanelProps = {
  user: User & { settings: UserSettings | null };
};

async function requestJson(url: string, method: "PATCH" | "POST", body: unknown) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo guardar.");
  }
}

export function SettingsPanel({ user }: SettingsPanelProps) {
  const profileForm = useForm({
    resolver: zodResolver(profileSchema) as never,
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? undefined,
    },
  });
  const preferencesForm = useForm({
    resolver: zodResolver(preferencesSchema) as never,
    defaultValues: {
      defaultCurrency: user.settings?.defaultCurrency ?? "DOP",
      preferredStrategy: user.settings?.preferredStrategy ?? "AVALANCHE",
      hybridRateWeight: user.settings?.hybridRateWeight ?? 70,
      hybridBalanceWeight: user.settings?.hybridBalanceWeight ?? 30,
      monthlyDebtBudget: Number(user.settings?.monthlyDebtBudget ?? 0),
      notifyDueSoon: user.settings?.notifyDueSoon ?? true,
      notifyOverdue: user.settings?.notifyOverdue ?? true,
      notifyMinimumRisk: user.settings?.notifyMinimumRisk ?? true,
      notifyMonthlyReport: user.settings?.notifyMonthlyReport ?? true,
      emailRemindersEnabled: user.settings?.emailRemindersEnabled ?? false,
      upcomingDueDays: user.settings?.upcomingDueDays ?? 3,
      timezone: user.settings?.timezone ?? user.timezone,
      language: user.settings?.language ?? "es",
    },
  });
  const watchedDueSoon = useWatch({ control: preferencesForm.control, name: "notifyDueSoon" });
  const watchedOverdue = useWatch({ control: preferencesForm.control, name: "notifyOverdue" });
  const watchedMinimumRisk = useWatch({
    control: preferencesForm.control,
    name: "notifyMinimumRisk",
  });
  const watchedMonthlyReport = useWatch({
    control: preferencesForm.control,
    name: "notifyMonthlyReport",
  });
  const watchedEmailReminders = useWatch({
    control: preferencesForm.control,
    name: "emailRemindersEnabled",
  });
  const hasPremiumGuidance =
    user.settings?.membershipBillingStatus === "ACTIVE" && user.settings?.membershipTier !== "FREE";
  const watchedUpcomingDueDays = useWatch({
    control: preferencesForm.control,
    name: "upcomingDueDays",
  });
  const activeReminderItems = [
    watchedDueSoon ? `Vencimientos en ${watchedUpcomingDueDays ?? 3} días` : null,
    watchedOverdue ? "Atrasos o mora" : null,
    watchedMinimumRisk ? "Pago mínimo riesgoso" : null,
    watchedMonthlyReport ? "Resumen mensual listo" : null,
  ].filter(Boolean) as string[];
  const reminderChannelLabel = watchedEmailReminders
    ? "App + email"
    : "Solo dentro de la app";
  const passwordForm = useForm({
    resolver: zodResolver(changePasswordSchema) as never,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  return (
    <div className="flex flex-col gap-6">
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
              <Input id="firstName" {...profileForm.register("firstName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" {...profileForm.register("lastName")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input id="avatarUrl" {...profileForm.register("avatarUrl")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Guardar perfil</Button>
            </div>
          </form>
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
                    Resumen de recordatorios
                  </p>
                  <p className="mt-3 text-xl font-semibold text-foreground">{reminderChannelLabel}</p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    {activeReminderItems.length
                      ? `Ahora mismo recibirás ${activeReminderItems.length} tipo${activeReminderItems.length === 1 ? "" : "s"} de alerta: ${activeReminderItems.join(", ")}.`
                      : "No hay recordatorios activos. Conviene dejar al menos vencimientos y atrasos encendidos para no perder control."}
                  </p>
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
                    }}
                  >
                    Modo básico
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      preferencesForm.setValue("notifyDueSoon", true);
                      preferencesForm.setValue("notifyOverdue", true);
                      preferencesForm.setValue("notifyMinimumRisk", true);
                      preferencesForm.setValue("notifyMonthlyReport", true);
                      preferencesForm.setValue("emailRemindersEnabled", true);
                    }}
                  >
                    Modo completo
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Canal</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{reminderChannelLabel}</p>
                </div>
                <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Alertas activas</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{activeReminderItems.length}</p>
                </div>
                <div className="rounded-3xl border border-white/70 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Aviso previo</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {watchedUpcomingDueDays ?? 3} día{(watchedUpcomingDueDays ?? 3) === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Moneda</Label>
              <select
                id="defaultCurrency"
                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                {...preferencesForm.register("defaultCurrency")}
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
                {...preferencesForm.register("preferredStrategy")}
              >
                <option value="AVALANCHE">Avalanche</option>
                <option value="SNOWBALL">Snowball</option>
                <option value="HYBRID">Híbrido</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hybridRateWeight">Peso tasa híbrida</Label>
              <Input id="hybridRateWeight" type="number" {...preferencesForm.register("hybridRateWeight", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hybridBalanceWeight">Peso saldo híbrido</Label>
              <Input id="hybridBalanceWeight" type="number" {...preferencesForm.register("hybridBalanceWeight", { valueAsNumber: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyDebtBudget">Presupuesto mensual</Label>
              <Input id="monthlyDebtBudget" type="number" step="0.01" {...preferencesForm.register("monthlyDebtBudget", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upcomingDueDays">Días de aviso</Label>
              <Input id="upcomingDueDays" type="number" {...preferencesForm.register("upcomingDueDays", { valueAsNumber: true })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Zona horaria</Label>
              <Input id="timezone" {...preferencesForm.register("timezone")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Idioma</Label>
              <select
                id="language"
                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                {...preferencesForm.register("language")}
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </div>

            {[
              ["notifyDueSoon", "Alertas de vencimiento cercano"],
              ["notifyOverdue", "Alertas por atraso"],
              ["notifyMinimumRisk", "Alertas de riesgo por mínimos"],
              ["notifyMonthlyReport", "Resumen mensual"],
              ["emailRemindersEnabled", "Recordatorios por email"],
            ].map(([name, label]) => (
              <label key={name} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/70 p-4">
                <input type="checkbox" className="mt-1 size-4" {...preferencesForm.register(name as never)} />
                <span className="text-sm text-muted">{label}</span>
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
                await requestJson("/api/auth/cambiar-contrasena", "POST", values);
                toast.success("Contraseña actualizada.");
                passwordForm.reset();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Contraseña actual</Label>
              <Input id="currentPassword" type="password" {...passwordForm.register("currentPassword")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nueva contraseña</Label>
              <Input id="newPassword" type="password" {...passwordForm.register("newPassword")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar</Label>
              <Input id="confirmPassword" type="password" {...passwordForm.register("confirmPassword")} />
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
