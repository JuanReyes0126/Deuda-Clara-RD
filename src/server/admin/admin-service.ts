import { AuditAction, UserStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { AdminOverviewDto } from "@/lib/types/app";
import { createAuditLog } from "@/server/audit/audit-service";
import { ServiceError } from "@/server/services/service-error";

export async function getAdminOverview(): Promise<AdminOverviewDto> {
  const [
    users,
    totalUsers,
    activeUsers,
    disabledUsers,
    totalDebts,
    overdueDebts,
    paymentCountLast30Days,
    freeUsers,
    premiumUsers,
    proUsers,
    activeBilling,
    pendingBilling,
    attentionBilling,
    emailReminderUsers,
    monthlyReportUsers,
    auditLogs,
    emailTemplates,
    recentDebts,
    recentPayments,
    recentNotifications,
  ] =
    await Promise.all([
      prisma.user.findMany({
        include: {
          settings: true,
          _count: {
            select: {
              debts: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 50,
      }),
      prisma.user.count(),
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { status: UserStatus.DISABLED } }),
      prisma.debt.count(),
      prisma.debt.count({ where: { status: "LATE", archivedAt: null } }),
      prisma.payment.count({
        where: {
          paidAt: {
            gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
          },
        },
      }),
      prisma.userSettings.count({ where: { membershipTier: "FREE" } }),
      prisma.userSettings.count({ where: { membershipTier: "NORMAL" } }),
      prisma.userSettings.count({ where: { membershipTier: "PRO" } }),
      prisma.userSettings.count({ where: { membershipBillingStatus: "ACTIVE" } }),
      prisma.userSettings.count({ where: { membershipBillingStatus: "PENDING" } }),
      prisma.userSettings.count({
        where: {
          membershipBillingStatus: {
            in: ["PAST_DUE", "CANCELED"],
          },
        },
      }),
      prisma.userSettings.count({ where: { emailRemindersEnabled: true } }),
      prisma.userSettings.count({ where: { notifyMonthlyReport: true } }),
      prisma.auditLog.findMany({
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      }),
      prisma.emailTemplate.findMany({
        orderBy: {
          updatedAt: "desc",
        },
      }),
      prisma.debt.findMany({
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
      }),
      prisma.payment.findMany({
        include: {
          user: {
            select: {
              email: true,
            },
          },
          debt: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [
          {
            paidAt: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 12,
      }),
      prisma.notification.findMany({
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
      }),
    ]);

  return {
    totalUsers,
    activeUsers,
    disabledUsers,
    totalDebts,
    overdueDebts,
    paymentCountLast30Days,
    membershipSummary: {
      freeUsers,
      premiumUsers,
      proUsers,
      activeBilling,
      pendingBilling,
      attentionBilling,
    },
    reminderSummary: {
      emailReminderUsers,
      monthlyReportUsers,
    },
    emailTemplateSummary: {
      totalTemplates: emailTemplates.length,
      activeTemplates: emailTemplates.filter((template) => template.isActive).length,
      inactiveTemplates: emailTemplates.filter((template) => !template.isActive).length,
    },
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      membershipTier: user.settings?.membershipTier ?? "FREE",
      membershipBillingStatus: user.settings?.membershipBillingStatus ?? "FREE",
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      debtCount: user._count.debts,
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId ?? null,
      createdAt: log.createdAt.toISOString(),
      userEmail: log.user?.email ?? null,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
    })),
    emailTemplates: emailTemplates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent,
      isActive: template.isActive,
      updatedAt: template.updatedAt.toISOString(),
    })),
    recentDebts: recentDebts.map((debt) => ({
      id: debt.id,
      name: debt.name,
      creditorName: debt.creditorName,
      userEmail: debt.user.email,
      status: debt.status,
      effectiveBalance:
        Number(debt.currentBalance) +
        Number(debt.lateFeeAmount) +
        Number(debt.extraChargesAmount),
      nextDueDate: debt.nextDueDate?.toISOString() ?? null,
      createdAt: debt.createdAt.toISOString(),
    })),
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      debtName: payment.debt.name,
      userEmail: payment.user.email,
      amount: Number(payment.amount),
      source: payment.source,
      paidAt: payment.paidAt.toISOString(),
      createdAt: payment.createdAt.toISOString(),
    })),
    recentNotifications: recentNotifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      type: notification.type,
      severity: notification.severity,
      userEmail: notification.user?.email ?? null,
      createdAt: notification.createdAt.toISOString(),
      sentAt: notification.sentAt?.toISOString() ?? null,
      readAt: notification.readAt?.toISOString() ?? null,
    })),
  };
}

export async function updateUserStatus(
  adminUserId: string,
  targetUserId: string,
  status: UserStatus,
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  if (adminUserId === targetUserId) {
    throw new ServiceError(
      "ADMIN_SELF_DISABLE_BLOCKED",
      400,
      "No puedes cambiar el estado de tu propia cuenta desde este panel.",
    );
  }

  const user = await prisma.user.update({
    where: {
      id: targetUserId,
    },
    data: {
      status,
    },
  });

  await createAuditLog({
    userId: adminUserId,
    action: AuditAction.USER_STATUS_CHANGED,
    resourceType: "user",
    resourceId: targetUserId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      status,
    },
  });

  return user;
}

export async function updateEmailTemplate(
  adminUserId: string,
  templateId: string,
  input: {
    name: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    isActive: boolean;
  },
  meta: { ipAddress?: string | undefined; userAgent?: string | undefined },
) {
  const template = await prisma.emailTemplate.update({
    where: {
      id: templateId,
    },
    data: input,
  });

  await createAuditLog({
    userId: adminUserId,
    action: AuditAction.EMAIL_TEMPLATE_UPDATED,
    resourceType: "email-template",
    resourceId: template.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return template;
}
