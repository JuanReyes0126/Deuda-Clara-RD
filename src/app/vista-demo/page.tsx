import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminOverview } from "@/features/admin/components/admin-overview";
import { DashboardOverview } from "@/features/dashboard/components/dashboard-overview";
import { DebtManager } from "@/features/debts/components/debt-manager";
import { MembershipPanel } from "@/features/membership/components/membership-panel";
import { NotificationCenter } from "@/features/notifications/components/notification-center";
import { PaymentManager } from "@/features/payments/components/payment-manager";
import { ReportsPanel } from "@/features/reports/components/reports-panel";
import {
  adminOverview,
  dashboardData,
  debtSummary,
  demoDebts,
  demoNotifications,
  demoPayments,
  membershipConversionSnapshot,
  reportSummary,
} from "@/lib/demo/data";

export const dynamic = "force-dynamic";

export default function DemoPreviewPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <Card className="p-8">
          <CardHeader>
            <CardTitle>Vista demo de Deuda Clara RD</CardTitle>
            <CardDescription>
              Esta ruta es solo para mostrar cómo quedó visualmente la app sin depender de login ni PostgreSQL.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted">
            Abre esta pantalla para ver el look & feel final del dashboard, gestión de deudas, pagos, reportes, notificaciones y panel admin.
          </CardContent>
        </Card>

        <DashboardOverview
          data={dashboardData}
          conversionSnapshot={membershipConversionSnapshot}
          premiumWelcome
        />

        <MembershipPanel
          currentTier="NORMAL"
          billingStatus="ACTIVE"
          billingConfigured
          canManageBilling
          currentPeriodEnd="2026-04-29T12:00:00.000Z"
          cancelAtPeriodEnd={false}
          conversionSnapshot={membershipConversionSnapshot}
          demoMode
        />

        <DebtManager
          debts={demoDebts}
          summary={debtSummary}
          membershipTier="NORMAL"
          billingStatus="ACTIVE"
        />

        <PaymentManager debts={demoDebts} payments={demoPayments} />

        <ReportsPanel
          initialSummary={reportSummary}
          membershipTier="NORMAL"
          billingStatus="ACTIVE"
        />

        <NotificationCenter
          initialNotifications={demoNotifications}
          membershipTier="NORMAL"
          billingStatus="ACTIVE"
        />

        <AdminOverview initialData={adminOverview} />
      </div>
    </div>
  );
}
