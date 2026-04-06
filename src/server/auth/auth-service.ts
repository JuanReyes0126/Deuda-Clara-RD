import { AuditAction, CurrencyCode, StrategyMethod } from "@prisma/client";

import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@/config/legal";
import { prisma } from "@/lib/db/prisma";
import { revokeOtherSessions, rotateCurrentSession } from "@/lib/auth/session";
import { decryptSensitiveText } from "@/lib/security/encryption";
import { verifyRecoveryCode, verifyTotpCode } from "@/lib/security/totp";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ReauthenticateInput,
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
import {
  logSecurityEvent,
  logServerError,
} from "@/server/observability/logger";

import { ServiceError } from "../services/service-error";
import { hashPassword, verifyPassword } from "./password";
import { generateOpaqueToken, hashOpaqueToken } from "./tokens";

type RequestMeta = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

const loginUserSelect = {
  id: true,
  email: true,
  passwordHash: true,
  firstName: true,
  lastName: true,
  status: true,
  onboardingCompleted: true,
  settings: {
    select: {
      mfaTotpEnabled: true,
      mfaTotpSecretEncrypted: true,
      mfaRecoveryCodesHashes: true,
    },
  },
} as const;

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
  const acceptedAt = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        termsAcceptedAt: acceptedAt,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
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
            preferredReminderDays: [5, 2, 0],
            preferredReminderHour: 8,
            upcomingDueDays: 3,
          },
        },
      },
    });

    await tx.userConsent.create({
      data: {
        userId: createdUser.id,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    await createAuditLog(
      {
        userId: createdUser.id,
        action: AuditAction.USER_REGISTERED,
        resourceType: "user",
        resourceId: createdUser.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          legalAccepted: true,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
          termsAcceptedAt: acceptedAt.toISOString(),
        },
      },
      tx,
    );

    return createdUser;
  });

  logSecurityEvent(
    "user_registered_with_legal_acceptance",
    {
      userId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: acceptedAt.toISOString(),
    },
    "info",
  );

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
    select: loginUserSelect,
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

  if (user.settings?.mfaTotpEnabled) {
    const hasTotpCode = Boolean(input.totpCode?.trim());
    const hasRecoveryCode = Boolean(input.recoveryCode?.trim());

    if (!hasTotpCode && !hasRecoveryCode) {
      throw new ServiceError(
        "MFA_REQUIRED",
        401,
        "Ingresa tu código de verificación o un código de respaldo.",
      );
    }

    let mfaVerified = false;

    if (hasTotpCode) {
      const totpSecret = decryptSensitiveText(user.settings.mfaTotpSecretEncrypted);

      if (!totpSecret) {
        throw new ServiceError(
          "MFA_CONFIGURATION_INVALID",
          500,
          "No pudimos validar tu segundo factor ahora mismo.",
        );
      }

      if (verifyTotpCode(totpSecret, input.totpCode ?? "")) {
        mfaVerified = true;
      }
    }

    if (!mfaVerified && hasRecoveryCode) {
      const recoveryResult = verifyRecoveryCode(
        input.recoveryCode ?? "",
        user.settings.mfaRecoveryCodesHashes,
      );

      if (recoveryResult.matched) {
        await prisma.userSettings.update({
          where: { userId: user.id },
          data: {
            mfaRecoveryCodesHashes: recoveryResult.remainingHashes,
          },
        });

        mfaVerified = true;
      }
    }

    if (!mfaVerified) {
      await createAuditLog({
        userId: user.id,
        action: AuditAction.LOGIN_FAILURE,
        resourceType: "auth",
        resourceId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          reason: hasRecoveryCode ? "invalid_recovery_code" : "invalid_totp",
        },
      });

      throw new ServiceError(
        "MFA_INVALID",
        401,
        hasRecoveryCode
          ? "El código de respaldo no es válido."
          : "El código de verificación no es válido.",
      );
    }
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

export async function reauthenticateUser(
  userId: string,
  input: ReauthenticateInput,
  meta: RequestMeta,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: loginUserSelect,
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", 404, "No se encontró la cuenta.");
  }

  if (user.status !== "ACTIVE") {
    throw new ServiceError("ACCOUNT_DISABLED", 403, "Tu cuenta está desactivada.");
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

  if (user.settings?.mfaTotpEnabled) {
    const hasTotpCode = Boolean(input.totpCode?.trim());
    const hasRecoveryCode = Boolean(input.recoveryCode?.trim());

    if (!hasTotpCode && !hasRecoveryCode) {
      throw new ServiceError(
        "MFA_REQUIRED",
        401,
        "Ingresa tu código de verificación o un código de respaldo.",
      );
    }

    let mfaVerified = false;

    if (hasTotpCode) {
      const totpSecret = decryptSensitiveText(user.settings.mfaTotpSecretEncrypted);

      if (!totpSecret) {
        throw new ServiceError(
          "MFA_CONFIGURATION_INVALID",
          500,
          "No pudimos validar tu segundo factor ahora mismo.",
        );
      }

      if (verifyTotpCode(totpSecret, input.totpCode ?? "")) {
        mfaVerified = true;
      }
    }

    if (!mfaVerified && hasRecoveryCode) {
      const recoveryResult = verifyRecoveryCode(
        input.recoveryCode ?? "",
        user.settings.mfaRecoveryCodesHashes,
      );

      if (recoveryResult.matched) {
        await prisma.userSettings.update({
          where: { userId: user.id },
          data: {
            mfaRecoveryCodesHashes: recoveryResult.remainingHashes,
          },
        });

        mfaVerified = true;
      }
    }

    if (!mfaVerified) {
      throw new ServiceError(
        "MFA_INVALID",
        401,
        hasRecoveryCode
          ? "El código de respaldo no es válido."
          : "El código de verificación no es válido.",
      );
    }
  }

  await createAuditLog({
    userId,
    action: AuditAction.LOGIN_SUCCESS,
    resourceType: "auth",
    resourceId: userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { securityEvent: "reauth_confirmed" },
  });
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

  await revokeOtherSessions(userId);
  await rotateCurrentSession(userId);

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
