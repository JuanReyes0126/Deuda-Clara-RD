import { Prisma } from "@prisma/client";

import {
  isPrismaClosedConnectionError,
  isPrismaReconnectableError,
} from "@/lib/db/prisma";

const transientPrismaCodes = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2021",
  "P2022",
]);

export function isInfrastructureUnavailableError(error: unknown) {
  if (isPrismaReconnectableError(error)) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    transientPrismaCodes.has(error.code)
  ) {
    return true;
  }

  return error instanceof Prisma.PrismaClientUnknownRequestError
    ? isPrismaClosedConnectionError(error)
    : false;
}
