import { Prisma } from "@prisma/client";

const transientPrismaCodes = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2021",
  "P2022",
]);

export function isInfrastructureUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    transientPrismaCodes.has(error.code)
  ) {
    return true;
  }

  return false;
}
