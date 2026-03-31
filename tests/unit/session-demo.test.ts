import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const cookiesMock = vi.fn(async () => cookieStore);
const findUniqueMock = vi.fn();
const deleteManyMock = vi.fn();

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
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/demo/session", () => ({
  getDemoSession: vi.fn(),
  clearDemoSession: vi.fn(),
  isDemoModeEnabled: vi.fn(() => true),
}));

vi.mock("@/server/services/database-availability", () => ({
  isDatabaseReachable: vi.fn(),
  markDatabaseUnavailable: vi.fn(),
}));

describe("auth session demo mode", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookiesMock.mockClear();
    findUniqueMock.mockReset();
    deleteManyMock.mockReset();
  });

  it("prioriza la sesion demo y no consulta Prisma", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { getDemoSession } = await import("@/lib/demo/session");

    vi.mocked(getDemoSession).mockResolvedValueOnce({
      id: "demo-session",
      user: { id: "demo-review-user", onboardingCompleted: true },
    } as never);

    const session = await getCurrentSession();

    expect(session).toMatchObject({ id: "demo-session" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("logout demo no intenta borrar sesiones reales si la base no responde", async () => {
    const { destroyCurrentSession } = await import("@/lib/auth/session");
    const { getDemoSession, clearDemoSession } = await import("@/lib/demo/session");
    const { isDatabaseReachable } = await import("@/server/services/database-availability");

    vi.mocked(getDemoSession).mockResolvedValueOnce({
      id: "demo-session",
      user: { id: "demo-review-user" },
    } as never);
    vi.mocked(isDatabaseReachable).mockResolvedValueOnce(false);

    await destroyCurrentSession();

    expect(deleteManyMock).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalled();
    expect(clearDemoSession).toHaveBeenCalled();
  });
});
