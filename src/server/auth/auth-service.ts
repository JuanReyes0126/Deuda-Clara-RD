import { AuditAction, CurrencyCode, StrategyMethod } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@/lib/validations/auth";
import { createAuditLog } from "@/server/audit/audit-service";
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildPasswordResetSuccessEmail,
  buildWelcomeEmail,
} from "@/server/mail/email-templates";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { logServerError } from "@/server/observability/logger";

import { ServiceError } from "../services/service-error";
import { hashPassword, verifyPassword } from "./password";
import { generateOpaqueToken, hashOpaqueToken } from "./tokens";

type RequestMeta = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

async function deliverAuthEmailSafely(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  context: string;
}) {
  try {
    await sendTransactionalEmail({
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (error) {
    logServerError(`Auth email delivery failed during ${input.context}`, {
      to: input.to,
      error,
    });
  }
}

export async function registerUser(input: RegisterInput, meta: RequestMeta) {
  const normalizedEmail = normalizeAuthEmail(input.email);
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (existingUser) {
    throw new ServiceError("EMAIL_IN_USE", 409, "Ya existe una cuenta con ese correo.");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      settings: {
        create: {
          defaultCurrency: CurrencyCode.DOP,
          preferredStrategy: StrategyMethod.AVALANCHE,
          membershipTier: "FREE",
          notifyDueSoon: true,
          notifyOverdue: true,
          notifyMinimumRisk: true,
          notifyMonthlyReport: true,
          emailRemindersEnabled: false,
          upcomingDueDays: 3,
        },
      },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: AuditAction.USER_REGISTERED,
    resourceType: "user",
    resourceId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const welcomeEmail = buildWelcomeEmail(user.firstName);
  await deliverAuthEmailSafely({
    to: user.email,
    subject: welcomeEmail.subject,
    html: welcomeEmail.html,
    text: welcomeEmail.text,
    context: "register",
  });

  return user;
}

export async function authenticateUser(input: LoginInput, meta: RequestMeta) {
  const normalizedEmail = normalizeAuthEmail(input.email);
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (!user) {
    await createAuditLog({
      action: AuditAction.LOGIN_FAILURE,
      resourceType: "auth",
      resourceId: normalizedEmail,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { email: normalizedEmail, reason: "user_not_found" },
    });

    throw new ServiceError("INVALID_CREDENTIALS", 401, "Correo o contraseña inválidos.");
  }

  if (user.status !== "ACTIVE") {
    throw new ServiceError("ACCOUNT_DISABLED", 403, "Tu cuenta está desactivada.");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);

  if (!isValid) {
    await createAuditLog({
      userId: user.id,
      action: AuditAction.LOGIN_FAILURE,
      resourceType: "auth",
      resourceId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { reason: "invalid_password" },
    });

    throw new ServiceError("INVALID_CREDENTIALS", 401, "Correo o contraseña inválidos.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createAuditLog({
    userId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    resourceType: "auth",
    resourceId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return user;
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
  meta: RequestMeta,
) {
  const normalizedEmail = normalizeAuthEmail(input.email);
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  });

  if (!user) {
    return;
  }

  const rawToken = generateOpaqueToken(32);
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const email = buildPasswordResetEmail(rawToken);

  await deliverAuthEmailSafely({
    to: user.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    context: "password_reset_request",
  });

  await createAuditLog({
    userId: user.id,
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    resourceType: "auth",
    resourceId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function resetPassword(input: ResetPasswordInput, meta: RequestMeta) {
  const tokenHash = hashOpaqueToken(input.token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    throw new ServiceError("RESET_TOKEN_INVALID", 400, "El enlace ya no es válido.");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  await createAuditLog({
    userId: resetToken.userId,
    action: AuditAction.PASSWORD_RESET_COMPLETED,
    resourceType: "auth",
    resourceId: resetToken.userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const confirmationEmail = buildPasswordResetSuccessEmail();
  await deliverAuthEmailSafely({
    to: resetToken.user.email,
    subject: confirmationEmail.subject,
    html: confirmationEmail.html,
    text: confirmationEmail.text,
    context: "password_reset_complete",
  });
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  meta: RequestMeta,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", 404, "No se encontró la cuenta.");
  }

  const passwordMatches = await verifyPassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new ServiceError(
      "CURRENT_PASSWORD_INVALID",
      400,
      "La contraseña actual no es correcta.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await createAuditLog({
    userId,
    action: AuditAction.PASSWORD_CHANGED,
    resourceType: "auth",
    resourceId: userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const confirmationEmail = buildPasswordChangedEmail();
  await deliverAuthEmailSafely({
    to: user.email,
    subject: confirmationEmail.subject,
    html: confirmationEmail.html,
    text: confirmationEmail.text,
    context: "password_change",
  });
}
