type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    value: error,
  };
}

function normalizeMeta(meta?: LogMeta) {
  if (!meta) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [
      key,
      key === "error" ? serializeError(value) : value,
    ]),
  );
}

function writeLog(level: LogLevel, message: string, meta?: LogMeta) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(normalizeMeta(meta) ?? {}),
  };

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.info(payload);
}

export function logServerInfo(message: string, meta?: LogMeta) {
  writeLog("info", message, meta);
}

export function logServerWarn(message: string, meta?: LogMeta) {
  writeLog("warn", message, meta);
}

export function logServerError(message: string, meta?: LogMeta) {
  writeLog("error", message, meta);
}
