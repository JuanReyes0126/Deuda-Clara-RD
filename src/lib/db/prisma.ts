import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function withPrismaPoolTuning(databaseUrl?: string) {
  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);
    const isDevelopment = process.env.NODE_ENV === "development";
    const isPooledHost = url.hostname.includes("-pooler.");

    url.searchParams.set(
      "connection_limit",
      isDevelopment ? "3" : url.searchParams.get("connection_limit") ?? "10",
    );

    if (isDevelopment || !url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", isDevelopment ? "30" : "20");
    }

    if (isDevelopment || !url.searchParams.has("connect_timeout")) {
      url.searchParams.set("connect_timeout", "15");
    }

    if (isPooledHost && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }

    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export const prisma =
  global.__prisma ??
  (() => {
    const tunedDatabaseUrl = withPrismaPoolTuning(process.env.DATABASE_URL);

    return new PrismaClient({
      ...(tunedDatabaseUrl
        ? {
            datasources: {
              db: {
                url: tunedDatabaseUrl,
              },
            },
          }
        : {}),
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  })();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

const closedConnectionPatterns = [
  /Error in PostgreSQL connection: Error \{ kind: Closed/i,
  /connection.+closed/i,
  /server has closed the connection/i,
  /terminating connection/i,
];

const transientReconnectCodes = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
]);

export function isPrismaClosedConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return closedConnectionPatterns.some((pattern) => pattern.test(error.message));
}

export function isPrismaReconnectableError(error: unknown) {
  if (isPrismaClosedConnectionError(error)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    transientReconnectCodes.has(error.code)
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return isPrismaClosedConnectionError(error);
  }

  return false;
}

export async function runWithPrismaReconnect<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isPrismaReconnectableError(error)) {
      throw error;
    }

    await prisma.$disconnect().catch(() => undefined);
    await prisma.$connect();

    return operation();
  }
}
