import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const transactionMock = vi.fn();
const userCreateMock = vi.fn();
const userConsentCreateMock = vi.fn();
const hashPasswordMock = vi.fn(async () => "hashed-password");
const createAuditLogMock = vi.fn();
const sendTransactionalEmailMock = vi.fn(async () => undefined);
const logSecurityEventMock = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: findFirstMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/server/auth/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: vi.fn(),
}));

vi.mock("@/server/audit/audit-service", () => ({
  createAuditLog: createAuditLogMock,
}));

vi.mock("@/server/mail/mail-service", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("@/server/mail/email-templates", () => ({
  buildWelcomeEmail: vi.fn(() => ({
    subject: "Bienvenida",
    html: "<p>hola</p>",
    text: "hola",
  })),
  buildPasswordChangedEmail: vi.fn(),
  buildPasswordResetEmail: vi.fn(),
  buildPasswordResetSuccessEmail: vi.fn(),
}));

vi.mock("@/server/observability/logger", () => ({
  logSecurityEvent: logSecurityEventMock,
  logServerError: vi.fn(),
}));

describe("registerUser legal consent", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    transactionMock.mockReset();
    userCreateMock.mockReset();
    userConsentCreateMock.mockReset();
    hashPasswordMock.mockClear();
    createAuditLogMock.mockReset();
    sendTransactionalEmailMock.mockReset();
    logSecurityEventMock.mockReset();
  });

  it("crea usuario y consentimiento legal dentro de la misma transacción", async () => {
    const acceptedUser = {
      id: "user-1",
      email: "ana@example.com",
      firstName: "Ana",
    };

    findFirstMock.mockResolvedValueOnce(null);
    userCreateMock.mockResolvedValueOnce(acceptedUser);
    userConsentCreateMock.mockResolvedValueOnce({
      id: "consent-1",
    });
    transactionMock.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: { create: userCreateMock },
        userConsent: { create: userConsentCreateMock },
        auditLog: { create: vi.fn() },
      }),
    );

    const { registerUser } = await import("@/server/auth/auth-service");

    const result = await registerUser(
      {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        password: "DeudaClara123",
        confirmPassword: "DeudaClara123",
        acceptLegal: true,
      },
      {
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
      },
    );

    expect(result).toEqual(acceptedUser);
    expect(userCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "ana@example.com",
          termsAcceptedAt: expect.any(Date),
          termsVersion: "v1.0",
          privacyVersion: "v1.0",
        }),
      }),
    );
    expect(userConsentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          termsVersion: "v1.0",
          privacyVersion: "v1.0",
          ipAddress: "127.0.0.1",
          userAgent: "Vitest",
        }),
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "USER_REGISTERED",
        metadata: expect.objectContaining({
          legalAccepted: true,
          termsVersion: "v1.0",
          privacyVersion: "v1.0",
        }),
      }),
      expect.any(Object),
    );
    expect(logSecurityEventMock).toHaveBeenCalledWith(
      "user_registered_with_legal_acceptance",
      expect.objectContaining({
        userId: "user-1",
      }),
      "info",
    );
  });
});
