import net from "node:net";

type AvailabilityCache = {
  checkedAt: number;
  available: boolean;
};

declare global {
  var __databaseAvailabilityCache: AvailabilityCache | undefined;
}

const DATABASE_CHECK_TTL_MS = 15_000;

function setAvailabilityCache(available: boolean) {
  global.__databaseAvailabilityCache = {
    available,
    checkedAt: Date.now(),
  };

  return available;
}

function getCachedAvailability() {
  const cached = global.__databaseAvailabilityCache;

  if (!cached) {
    return null;
  }

  if (Date.now() - cached.checkedAt > DATABASE_CHECK_TTL_MS) {
    return null;
  }

  return cached.available;
}

function tcpCheck(host: string, port: number, timeoutMs = 700) {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function isDatabaseReachable(options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh) {
    const cached = getCachedAvailability();

    if (cached !== null) {
      return cached;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return setAvailabilityCache(false);
  }

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname;
    const port = Number(parsed.port || "5432");
    const available = await tcpCheck(host, port);

    return setAvailabilityCache(available);
  } catch {
    return setAvailabilityCache(false);
  }
}

export function markDatabaseUnavailable() {
  setAvailabilityCache(false);
}
