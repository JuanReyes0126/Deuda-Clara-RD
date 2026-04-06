import { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type CreateAuditLogInput = {
  userId?: string | undefined;
  debtId?: string | undefined;
  paymentId?: string | undefined;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
};

type AuditLogClient =
  | Pick<typeof prisma, "auditLog">
  | Pick<Prisma.TransactionClient, "auditLog">;

export async function createAuditLog(
  input: CreateAuditLogInput,
  client: AuditLogClient = prisma,
) {
  await client.auditLog.create({
    data: {
      action: input.action,
      resourceType: input.resourceType,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.debtId ? { debtId: input.debtId } : {}),
      ...(input.paymentId ? { paymentId: input.paymentId } : {}),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}
