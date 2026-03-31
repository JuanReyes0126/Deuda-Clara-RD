import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/security/origin";
import { onboardingSchema } from "@/lib/validations/settings";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/server/audit/audit-service";
import { AuditAction } from "@prisma/client";

export async function POST(request: NextRequest) {
  assertSameOrigin(request);

  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = onboardingSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      onboardingCompleted: true,
      settings: {
        upsert: {
          create: {
            defaultCurrency: "DOP",
            preferredStrategy: parsed.data.preferredStrategy,
            monthlyDebtBudget: parsed.data.monthlyDebtBudget,
            emailRemindersEnabled: parsed.data.emailRemindersEnabled,
            notifyDueSoon: parsed.data.notifyDueSoon,
            notifyOverdue: parsed.data.notifyOverdue,
            notifyMinimumRisk: parsed.data.notifyMinimumRisk,
            notifyMonthlyReport: true,
            upcomingDueDays: 3,
            timezone: session.user.timezone,
          },
          update: {
            preferredStrategy: parsed.data.preferredStrategy,
            monthlyDebtBudget: parsed.data.monthlyDebtBudget,
            emailRemindersEnabled: parsed.data.emailRemindersEnabled,
            notifyDueSoon: parsed.data.notifyDueSoon,
            notifyOverdue: parsed.data.notifyOverdue,
            notifyMinimumRisk: parsed.data.notifyMinimumRisk,
          },
        },
      },
    },
  });

  await createAuditLog({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "user-settings",
    resourceId: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
