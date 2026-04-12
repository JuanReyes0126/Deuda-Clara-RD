import { Prisma } from "@prisma/client";

import { isPrismaClosedConnectionError } from "@/lib/db/prisma";

const transientPrismaCodes = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2021",
  "P2022",
]);

export function isInfrastructureUnavailableError(error: unknown) {
  if (isPrismaClosedConnectionError(error)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    transientPrismaCodes.has(error.code)
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return isPrismaClosedConnectionError(error);
  }

  return false;
}
