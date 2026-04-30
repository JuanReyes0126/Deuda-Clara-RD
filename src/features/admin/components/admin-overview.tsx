"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";
import { readJsonPayload } from "@/lib/http/read-json-payload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminOverviewDto } from "@/lib/types/app";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

async function requestJson(url: string, method: "PATCH", body: unknown) {
  const response = await fetchWithCsrf(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await readJsonPayload<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(payload.error ?? "No se pudo completar la operación.");
  }
}

export function AdminOverview({
  initialData,
  internalMode = false,
}: {
  initialData: AdminOverviewDto;
  internalMode?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const membershipLabelMap: Record<string, string> = {
    FREE: "Base",
    NORMAL: "Premium",
    PRO: "Pro",
  };
  const billingLabelMap: Record<string, string> = {
    FREE: "Base",
    PENDING: "Pendiente",
    ACTIVE: "Activa",
    PAST_DUE: "Pago pendiente",
    CANCELED: "Cancelada",
    INACTIVE: "Inactiva",
  };

  const updateStatus = async (userId: string, status: "ACTIVE" | "DISABLED") => {
    try {
      await requestJson(`/api/admin/users/${userId}/status`, "PATCH", { status });
      setData((current) => ({
        ...current,
        users: current.users.map((user) =>
          user.id === userId ? { ...user, status } : user,
        ),
      }));
      toast.success("Estado actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar.");
    }
  };

  const saveTemplate = async (templateId: string, formData: FormData) => {
    try {
      await requestJson(`/api/admin/email-templates/${templateId}`, "PATCH", {
        name: String(formData.get("name") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        htmlContent: String(formData.get("htmlContent") ?? ""),
        textContent: String(formData.get("textContent") ?? ""),
        isActive: formData.get("isActive") === "on",
      });
      toast.success("Plantilla actualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {internalMode ? (
        <section
          id="overview"
          className="rounded-[2rem] border border-border/80 bg-white/90 p-6 shadow-soft"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Operación interna
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-foreground">
                Panel privado de monitoreo y gestión
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted">
                Este acceso no está enlazado en la experiencia pública. Desde
                aquí puedes vigilar usuarios, finanzas recientes, membresías,
                actividad y envíos operativos sin salir del sistema.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge variant="success">Ruta interna activa</Badge>
              <Badge variant="default">Modo host</Badge>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          ["Usuarios", data.totalUsers],
          ["Activos", data.activeUsers],
          ["Desactivados", data.disabledUsers],
          ["Deudas", data.totalDebts],
          ["Atrasadas", data.overdueDebts],
          ["Pagos 30d", data.paymentCountLast30Days],
        ].map(([label, value]) => (
          <Card key={label} className="p-6">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="mt-3 text-3xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section
        id="membership"
        className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
      >
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Membresías y conversión</CardTitle>
            <CardDescription>Panorama rápido de Base, Premium, Pro y estados de cobro.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 pt-4">
            <div className="rounded-2xl border border-border bg-secondary/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Usuarios por plan</p>
              <div className="mt-3 space-y-2 text-sm text-foreground">
                <p>Base: <span className="font-semibold">{data.membershipSummary.freeUsers}</span></p>
                <p>Premium: <span className="font-semibold">{data.membershipSummary.premiumUsers}</span></p>
                <p>Pro: <span className="font-semibold">{data.membershipSummary.proUsers}</span></p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Estado de facturación</p>
              <div className="mt-3 space-y-2 text-sm text-foreground">
                <p>Activas: <span className="font-semibold">{data.membershipSummary.activeBilling}</span></p>
                <p>Pendientes: <span className="font-semibold">{data.membershipSummary.pendingBilling}</span></p>
                <p>Con atención: <span className="font-semibold">{data.membershipSummary.attentionBilling}</span></p>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-secondary/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Retención por recordatorios</p>
              <div className="mt-3 space-y-2 text-sm text-foreground">
                <p>Email activo: <span className="font-semibold">{data.reminderSummary.emailReminderUsers}</span></p>
                <p>Resumen mensual: <span className="font-semibold">{data.reminderSummary.monthlyReportUsers}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>Salud de emails</CardTitle>
            <CardDescription>Estado rápido de las plantillas operativas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4">
            <div className="rounded-2xl border border-border bg-secondary/70 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Plantillas</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">{data.emailTemplateSummary.totalTemplates}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-secondary/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Activas</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.emailTemplateSummary.activeTemplates}</p>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Inactivas</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.emailTemplateSummary.inactiveTemplates}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card id="users" className="p-6">
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>Activa o desactiva cuentas y vigila uso general del sistema.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {data.users.map((user) => (
            <div key={user.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/70 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold text-foreground">
                    {user.firstName} {user.lastName}
                  </p>
                  <Badge variant={user.membershipTier === "FREE" ? "default" : "success"}>
                    {membershipLabelMap[user.membershipTier] ?? user.membershipTier}
                  </Badge>
                  <Badge
                    variant={
                      user.membershipBillingStatus === "PAST_DUE"
                        ? "warning"
                        : user.membershipBillingStatus === "ACTIVE"
                          ? "success"
                          : "default"
                    }
                  >
                    {billingLabelMap[user.membershipBillingStatus] ?? user.membershipBillingStatus}
                  </Badge>
                </div>
                <p className="text-sm text-muted">{user.email}</p>
                <p className="text-sm text-muted">
                  {user.role} · {user.debtCount} deudas · creado {formatDate(user.createdAt)}
                </p>
                {user.lastLoginAt ? (
                  <p className="text-sm text-muted">Último login: {formatDate(user.lastLoginAt, "dd MMM yyyy HH:mm")}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => updateStatus(user.id, "ACTIVE")}
                  disabled={user.status === "ACTIVE"}
                >
                  Activar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => updateStatus(user.id, "DISABLED")}
                  disabled={user.status === "DISABLED"}
                >
                  Desactivar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section id="finance" className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Deudas recientes del sistema</CardTitle>
            <CardDescription>
              Vista operativa de las últimas deudas registradas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.recentDebts.map((debt) => (
              <div
                key={debt.id}
                className="rounded-2xl border border-border bg-secondary/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {debt.name}
                    </p>
                    <p className="text-sm text-muted">
                      {debt.creditorName} · {debt.userEmail}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      Creada {formatDate(debt.createdAt, "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={debt.status === "LATE" ? "warning" : "default"}
                    >
                      {debt.status}
                    </Badge>
                    <Badge variant="default">
                      {formatCurrency(debt.effectiveBalance)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {debt.nextDueDate
                    ? `Próximo vencimiento: ${formatDate(debt.nextDueDate)}`
                    : "Sin próximo vencimiento registrado."}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>Pagos recientes del sistema</CardTitle>
            <CardDescription>
              Historial operativo rápido sin entrar al panel del usuario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-2xl border border-border bg-secondary/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {payment.debtName}
                    </p>
                    <p className="text-sm text-muted">{payment.userEmail}</p>
                    <p className="mt-2 text-sm text-muted">
                      {formatDate(payment.paidAt, "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{payment.source}</Badge>
                    <Badge variant="success">
                      {formatCurrency(payment.amount)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card id="activity" className="p-6">
          <CardHeader>
            <CardTitle>Auditoría y logs</CardTitle>
            <CardDescription>Eventos recientes para control operativo y seguridad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.auditLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border bg-secondary/70 p-4">
                <p className="font-semibold text-foreground">
                  {log.action} · {log.resourceType}
                </p>
                <p className="text-sm text-muted">
                  {log.userEmail ?? "Sistema"} · {formatDate(log.createdAt, "dd MMM yyyy HH:mm")}
                </p>
                {log.metadata ? (
                  <p className="mt-2 text-xs leading-6 text-muted">{log.metadata}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="notifications" className="p-6">
          <CardHeader>
            <CardTitle>Notificaciones recientes</CardTitle>
            <CardDescription>
              Estado rápido de avisos generados por el sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {data.recentNotifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-2xl border border-border bg-secondary/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted">
                      {notification.userEmail ?? "Sin usuario"} ·{" "}
                      {notification.type}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {formatDate(notification.createdAt, "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        notification.severity === "CRITICAL"
                          ? "danger"
                          : notification.severity === "WARNING"
                            ? "warning"
                            : "default"
                      }
                    >
                      {notification.severity}
                    </Badge>
                    <Badge variant={notification.readAt ? "success" : "default"}>
                      {notification.readAt ? "Leída" : "Pendiente"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">
                  {notification.sentAt
                    ? `Enviada ${formatDate(notification.sentAt, "dd MMM yyyy HH:mm")}`
                    : "Aún no marcada como enviada."}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-1">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>Plantillas de email</CardTitle>
            <CardDescription>Gestiona los mensajes operativos sin tocar código.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {data.emailTemplates.map((template) => (
              <form
                key={template.id}
                className="rounded-2xl border border-border bg-secondary/70 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveTemplate(template.id, new FormData(event.currentTarget));
                }}
              >
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={template.isActive ? "success" : "default"}>
                      {template.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                    <Badge variant="default">{template.key}</Badge>
                    <span className="text-xs text-muted">
                      Actualizada {formatDate(template.updatedAt, "dd MMM yyyy HH:mm")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input name="name" defaultValue={template.name} />
                  </div>
                  <div className="space-y-2">
                    <Label>Asunto</Label>
                    <Input name="subject" defaultValue={template.subject} />
                  </div>
                  <div className="space-y-2">
                    <Label>HTML</Label>
                    <Textarea name="htmlContent" defaultValue={template.htmlContent} />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto plano</Label>
                    <Textarea name="textContent" defaultValue={template.textContent} />
                  </div>
                  <label className="flex items-center gap-3 text-sm text-muted">
                    <input type="checkbox" name="isActive" defaultChecked={template.isActive} />
                    Plantilla activa
                  </label>
                  <Button type="submit" variant="secondary">
                    Guardar plantilla
                  </Button>
                </div>
              </form>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
