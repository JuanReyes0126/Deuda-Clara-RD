import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { AuditAction } from "@prisma/client";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getPasskeyConfig } from "@/lib/security/passkeys";
import { sanitizeText } from "@/lib/security/sanitize";
import type { PasskeyPublicDto } from "@/lib/types/app";
import { createAuditLog } from "@/server/audit/audit-service";
import {
  buildPasskeyDeletedEmail,
  buildPasskeyRegisteredEmail,
} from "@/server/mail/email-templates";
import { sendTransactionalEmail } from "@/server/mail/mail-service";
import { logServerError } from "@/server/observability/logger";
import { ServiceError } from "@/server/services/service-error";

type RequestMeta = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

async function deliverPasskeySecurityEmailSafely(input: {
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
    logServerError(`Passkey security email delivery failed during ${input.context}`, {
      to: input.to,
      error,
    });
  }
}

type PasskeyRecord = {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  transports: string[];
  name: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toPasskeyPublic(passkey: PasskeyRecord): PasskeyPublicDto {
  return {
    id: passkey.id,
    name: passkey.name,
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    transports: passkey.transports,
    createdAt: passkey.createdAt.toISOString(),
    lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
  };
}

function getStoredPasskeyName(
  suggestedName: string | null | undefined,
  currentCount: number,
) {
  const sanitized = sanitizeText(suggestedName ?? "").slice(0, 80);

  return sanitized.length > 0
    ? sanitized
    : `Passkey ${currentCount + 1}`;
}

function decodeStoredPublicKey(publicKey: string) {
  return new Uint8Array(Buffer.from(publicKey, "base64url"));
}

const validAuthenticatorTransports = new Set<AuthenticatorTransportFuture>([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

function toAuthenticatorTransports(transports: string[]) {
  return transports.filter((transport): transport is AuthenticatorTransportFuture =>
    validAuthenticatorTransports.has(transport as AuthenticatorTransportFuture),
  );
}

async function listUserPasskeys(userId: string) {
  const passkeys = await prisma.passkeyCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      deviceType: true,
      backedUp: true,
      transports: true,
      name: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return passkeys.map((passkey) =>
    toPasskeyPublic({
      ...passkey,
      deviceType:
        passkey.deviceType === "singleDevice" ? "singleDevice" : "multiDevice",
    }),
  );
}

export async function createPasskeyRegistrationOptions(
  userId: string,
  request: NextRequest,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      passkeyCredentials: {
        select: {
          credentialId: true,
          transports: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ServiceError("USER_NOT_FOUND", 404, "No se pudo preparar la passkey.");
  }

  const { rpID, rpName } = getPasskeyConfig(request);

  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userName: user.email,
    userDisplayName: `${user.firstName} ${user.lastName}`.trim(),
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: user.passkeyCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: toAuthenticatorTransports(credential.transports),
    })),
    preferredAuthenticatorType: "localDevice",
  });

  return { options };
}

export async function verifyPasskeyRegistration(
  userId: string,
  credential: RegistrationResponseJSON,
  expectedChallenge: string,
  request: NextRequest,
  meta: RequestMeta,
  name?: string | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      status: true,
      passkeyCredentials: {
        select: {
          id: true,
          credentialId: true,
          publicKey: true,
          counter: true,
          deviceType: true,
          backedUp: true,
          transports: true,
          name: true,
          createdAt: true,
          lastUsedAt: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new ServiceError("USER_NOT_FOUND", 404, "No se pudo registrar la passkey.");
  }

  const { expectedOrigins, expectedRPIDs } = getPasskeyConfig(request);
  const verification = await verifyRegistrationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin: expectedOrigins,
    expectedRPID: expectedRPIDs,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new ServiceError(
      "PASSKEY_REGISTRATION_INVALID",
      400,
      "No pudimos verificar esta passkey.",
    );
  }

  const { registrationInfo } = verification;
  const credentialId = registrationInfo.credential.id;
  const existingCredential = await prisma.passkeyCredential.findUnique({
    where: { credentialId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (existingCredential?.userId === userId) {
    throw new ServiceError(
      "PASSKEY_ALREADY_REGISTERED",
      409,
      "Este dispositivo ya estaba registrado.",
    );
  }

  if (existingCredential) {
    throw new ServiceError(
      "PASSKEY_IN_USE",
      409,
      "Esta passkey ya está asociada a otra cuenta.",
    );
  }

  const savedPasskey = await prisma.passkeyCredential.create({
    data: {
      userId,
      credentialId,
      publicKey: Buffer.from(registrationInfo.credential.publicKey).toString(
        "base64url",
      ),
      counter: registrationInfo.credential.counter,
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
      transports: credential.response.transports ?? [],
      name: getStoredPasskeyName(name, user.passkeyCredentials.length),
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "passkey",
    resourceId: credentialId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      securityEvent: "passkey_registered",
      deviceType: registrationInfo.credentialDeviceType,
      backedUp: registrationInfo.credentialBackedUp,
    },
  });

  const confirmationEmail = buildPasskeyRegisteredEmail({
    firstName: user.firstName,
    passkeyName: savedPasskey.name,
  });
  await deliverPasskeySecurityEmailSafely({
    to: user.email,
    subject: confirmationEmail.subject,
    html: confirmationEmail.html,
    text: confirmationEmail.text,
    context: "passkey_register",
  });

  const passkeys = await listUserPasskeys(userId);

  return {
    passkey: passkeys.find((passkey) => passkey.id === savedPasskey.id) ?? null,
    passkeys,
  };
}

export async function createPasskeyAuthenticationOptions(
  email: string,
  request: NextRequest,
  meta: RequestMeta,
) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      status: true,
      passkeyCredentials: {
        select: {
          credentialId: true,
          transports: true,
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE" || user.passkeyCredentials.length === 0) {
    await createAuditLog({
      action: AuditAction.LOGIN_FAILURE,
      resourceType: "auth",
      resourceId: normalizedEmail,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        method: "passkey",
        reason: !user ? "user_not_found" : "passkey_not_available",
      },
    });

    throw new ServiceError(
      "PASSKEY_LOGIN_UNAVAILABLE",
      401,
      "No pudimos iniciar con passkey para ese correo.",
    );
  }

  const { rpID } = getPasskeyConfig(request);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user.passkeyCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: toAuthenticatorTransports(credential.transports),
    })),
    userVerification: "required",
  });

  return {
    options,
    userId: user.id,
  };
}

export async function verifyPasskeyAuthentication(
  credential: AuthenticationResponseJSON,
  expectedChallenge: string,
  expectedUserId: string,
  request: NextRequest,
  meta: RequestMeta,
) {
  const passkey = await prisma.passkeyCredential.findUnique({
    where: { credentialId: credential.id },
    select: {
      id: true,
      userId: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      backedUp: true,
      deviceType: true,
      transports: true,
      user: {
        select: {
          id: true,
          status: true,
          onboardingCompleted: true,
        },
      },
    },
  });

  if (
    !passkey ||
    passkey.userId !== expectedUserId ||
    passkey.user.status !== "ACTIVE"
  ) {
    throw new ServiceError(
      "PASSKEY_LOGIN_INVALID",
      401,
      "No pudimos verificar la passkey.",
    );
  }

  const { expectedOrigins, expectedRPIDs } = getPasskeyConfig(request);
  const verification = await verifyAuthenticationResponse({
    response: credential,
    expectedChallenge,
    expectedOrigin: expectedOrigins,
    expectedRPID: expectedRPIDs,
    credential: {
      id: passkey.credentialId,
      publicKey: decodeStoredPublicKey(passkey.publicKey),
      counter: passkey.counter,
      transports: toAuthenticatorTransports(passkey.transports),
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    await createAuditLog({
      userId: passkey.userId,
      action: AuditAction.LOGIN_FAILURE,
      resourceType: "auth",
      resourceId: passkey.userId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        method: "passkey",
        reason: "verification_failed",
      },
    });

    throw new ServiceError(
      "PASSKEY_LOGIN_INVALID",
      401,
      "No pudimos verificar la passkey.",
    );
  }

  await prisma.$transaction([
    prisma.passkeyCredential.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: passkey.userId },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  await createAuditLog({
    userId: passkey.userId,
    action: AuditAction.LOGIN_SUCCESS,
    resourceType: "auth",
    resourceId: passkey.userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      method: "passkey",
      passkeyId: passkey.id,
    },
  });

  return {
    id: passkey.user.id,
    onboardingCompleted: passkey.user.onboardingCompleted,
  };
}

export async function deleteUserPasskey(
  userId: string,
  passkeyId: string,
  meta: RequestMeta,
) {
  const passkey = await prisma.passkeyCredential.findFirst({
    where: {
      id: passkeyId,
      userId,
    },
    select: {
      id: true,
      credentialId: true,
      name: true,
      user: {
        select: {
          email: true,
          firstName: true,
        },
      },
    },
  });

  if (!passkey) {
    throw new ServiceError("PASSKEY_NOT_FOUND", 404, "La passkey no fue encontrada.");
  }

  await prisma.passkeyCredential.delete({
    where: { id: passkey.id },
  });

  await createAuditLog({
    userId,
    action: AuditAction.SETTINGS_UPDATED,
    resourceType: "passkey",
    resourceId: passkey.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      securityEvent: "passkey_deleted",
      credentialId: passkey.credentialId,
    },
  });

  const confirmationEmail = buildPasskeyDeletedEmail({
    firstName: passkey.user.firstName,
    passkeyName: passkey.name,
  });
  await deliverPasskeySecurityEmailSafely({
    to: passkey.user.email,
    subject: confirmationEmail.subject,
    html: confirmationEmail.html,
    text: confirmationEmail.text,
    context: "passkey_delete",
  });

  return {
    passkeys: await listUserPasskeys(userId),
  };
}
