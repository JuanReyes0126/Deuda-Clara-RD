import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const cookiesMock = vi.fn(async () => cookieStore);
const findUniqueMock = vi.fn();
const deleteManyMock = vi.fn();
const runWithPrismaReconnectMock = vi.fn(async <T>(operation: () => Promise<T> | T) => operation());
const isPrismaClosedConnectionErrorMock = vi.fn(() => false);
const getDemoSessionMock = vi.fn();
const clearDemoSessionMock = vi.fn();
const isDemoModeEnabledMock = vi.fn(() => true);
const isDatabaseReachableMock = vi.fn();
const markDatabaseUnavailableMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    session: {
      findUnique: findUniqueMock,
      deleteMany: deleteManyMock,
    },
  },
  runWithPrismaReconnect: runWithPrismaReconnectMock,
  isPrismaClosedConnectionError: isPrismaClosedConnectionErrorMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/demo/session", () => ({
  getDemoSession: getDemoSessionMock,
  clearDemoSession: clearDemoSessionMock,
  isDemoModeEnabled: isDemoModeEnabledMock,
}));

vi.mock("@/server/services/database-availability", () => ({
  isDatabaseReachable: isDatabaseReachableMock,
  markDatabaseUnavailable: markDatabaseUnavailableMock,
}));

describe("auth session demo mode", () => {
  beforeEach(() => {
    vi.resetModules();
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookiesMock.mockClear();
    findUniqueMock.mockReset();
    deleteManyMock.mockReset();
    runWithPrismaReconnectMock.mockClear();
    isPrismaClosedConnectionErrorMock.mockReset();
    isPrismaClosedConnectionErrorMock.mockReturnValue(false);
    getDemoSessionMock.mockReset();
    clearDemoSessionMock.mockReset();
    isDemoModeEnabledMock.mockReset();
    isDemoModeEnabledMock.mockReturnValue(true);
    isDatabaseReachableMock.mockReset();
    markDatabaseUnavailableMock.mockReset();
  });

  it("prioriza la sesion demo y no consulta Prisma", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");

    getDemoSessionMock.mockResolvedValueOnce({
      id: "demo-session",
      user: { id: "demo-review-user", onboardingCompleted: true },
    } as never);

    const session = await getCurrentSession();

    expect(session).toMatchObject({ id: "demo-session" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  }, 15000);

  it("logout demo no intenta borrar sesiones reales si la base no responde", async () => {
    const { destroyCurrentSession } = await import("@/lib/auth/session");

    getDemoSessionMock.mockResolvedValueOnce({
      id: "demo-session",
      user: { id: "demo-review-user" },
    } as never);
    isDatabaseReachableMock.mockResolvedValueOnce(false);

    await destroyCurrentSession();

    expect(deleteManyMock).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalled();
    expect(clearDemoSessionMock).toHaveBeenCalled();
  }, 15000);
});
