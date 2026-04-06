import { PrismaClient } from "@prisma/client";

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
