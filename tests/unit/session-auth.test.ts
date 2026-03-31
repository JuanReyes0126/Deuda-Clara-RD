import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashOpaqueToken } from "@/server/auth/tokens";

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const cookiesMock = vi.fn(async () => cookieStore);
const redirectMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
const deleteManyMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/demo/session", () => ({
  getDemoSession: vi.fn(async () => null),
  clearDemoSession: vi.fn(),
  isDemoModeEnabled: vi.fn(() => false),
}));

vi.mock("@/server/services/database-availability", () => ({
  isDatabaseReachable: vi.fn(async () => true),
  markDatabaseUnavailable: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    session: {
      create: createMock,
      deleteMany: deleteManyMock,
      findUnique: findUniqueMock,
    },
  },
}));

describe("auth session access", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    cookieStore.delete.mockReset();
    cookiesMock.mockClear();
    redirectMock.mockReset();
    findUniqueMock.mockReset();
    createMock.mockReset();
    deleteManyMock.mockReset();
  });

  it("lee la cookie actual en cada llamada para no reciclar una sesion vieja", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const futureDate = new Date("2030-01-01T00:00:00.000Z");

    cookieStore.get
      .mockReturnValueOnce({ value: "token-a" })
      .mockReturnValueOnce({ value: "token-b" });

    findUniqueMock
      .mockResolvedValueOnce({
        id: "session-a",
        expires: futureDate,
        user: {
          id: "user-a",
          status: "ACTIVE",
          settings: {},
        },
      })
      .mockResolvedValueOnce({
        id: "session-b",
        expires: futureDate,
        user: {
          id: "user-b",
          status: "ACTIVE",
          settings: {},
        },
      });

    const firstSession = await getCurrentSession();
    const secondSession = await getCurrentSession();

    expect(findUniqueMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          sessionToken: hashOpaqueToken("token-a"),
        },
      }),
    );
    expect(findUniqueMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          sessionToken: hashOpaqueToken("token-b"),
        },
      }),
    );
    expect(firstSession).toMatchObject({ id: "session-a" });
    expect(secondSession).toMatchObject({ id: "session-b" });
  });
});
