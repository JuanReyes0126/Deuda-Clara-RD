type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(password|secret|token|authorization|cookie|set-cookie|signature|api[-_]?key)([_-]|$)/i;

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

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED_VALUE;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeValue(nestedKey, nestedValue),
      ]),
    );
  }

  return value;
}

function normalizeMeta(meta?: LogMeta) {
  if (!meta) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(meta).map(([key, value]) => [
      key,
      sanitizeValue(key, key === "error" ? serializeError(value) : value),
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

export function logSecurityEvent(
  event: string,
  meta?: LogMeta,
  level: Exclude<LogLevel, "error"> = "warn",
) {
  writeLog(level, `security:${event}`, meta);
}
