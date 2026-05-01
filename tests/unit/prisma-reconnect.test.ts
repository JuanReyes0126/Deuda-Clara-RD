import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

import {
  isPrismaReconnectableError,
  prisma,
  runWithPrismaReconnect,
} from "@/lib/db/prisma";

function buildKnownRequestError(code: string, message = "database error") {
  const error = Object.assign(new Error(message), {
    code,
    clientVersion: "6.19.3",
    meta: {},
  });

  Object.setPrototypeOf(error, Prisma.PrismaClientKnownRequestError.prototype);

  return error as Prisma.PrismaClientKnownRequestError;
}

describe("prisma reconnect guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reconoce errores transitorios de conexión como reintentables", () => {
    expect(
      isPrismaReconnectableError(
        new Error("Error in PostgreSQL connection: Error { kind: Closed }"),
      ),
    ).toBe(true);

    expect(
      isPrismaReconnectableError(
        new Prisma.PrismaClientInitializationError("db down", "6.19.3"),
      ),
    ).toBe(true);

    expect(isPrismaReconnectableError(buildKnownRequestError("P1001"))).toBe(true);
    expect(isPrismaReconnectableError(buildKnownRequestError("P1017"))).toBe(true);
  });

  it("no marca errores de esquema como reintentables", () => {
    expect(isPrismaReconnectableError(buildKnownRequestError("P2022"))).toBe(false);
  });

  it("reintenta la operación después de reconectar Prisma", async () => {
    const disconnectSpy = vi.spyOn(prisma, "$disconnect").mockResolvedValue();
    const connectSpy = vi.spyOn(prisma, "$connect").mockResolvedValue();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(buildKnownRequestError("P1001"))
      .mockResolvedValueOnce("ok");

    await expect(runWithPrismaReconnect(operation)).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("no reconecta cuando el error no es transitorio", async () => {
    const disconnectSpy = vi.spyOn(prisma, "$disconnect").mockResolvedValue();
    const connectSpy = vi.spyOn(prisma, "$connect").mockResolvedValue();
    const error = buildKnownRequestError("P2022");
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(runWithPrismaReconnect(operation)).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
