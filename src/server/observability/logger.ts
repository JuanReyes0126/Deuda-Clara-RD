type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, unknown>;
type SecurityAlertRule = {
  threshold: number;
  windowMs: number;
};

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(^|[_-])(password|secret|token|authorization|cookie|set-cookie|signature|api[-_]?key)([_-]|$)/i;
const securityAlertCounters = new Map<
  string,
  { count: number; windowStartedAt: number; lastAlertAt?: number }
>();
const securityAlertRules: Record<string, SecurityAlertRule> = {
  cron_secret_rejected: { threshold: 3, windowMs: 5 * 60 * 1000 },
  origin_blocked: { threshold: 10, windowMs: 5 * 60 * 1000 },
  csrf_token_invalid: { threshold: 10, windowMs: 5 * 60 * 1000 },
  rate_limit_login: { threshold: 20, windowMs: 10 * 60 * 1000 },
  rate_limit_register: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_reset_password: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_forgot_password: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_reauth: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_change_password: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_settings_update: { threshold: 20, windowMs: 10 * 60 * 1000 },
  rate_limit_billing_checkout: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_billing_portal: { threshold: 10, windowMs: 10 * 60 * 1000 },
  rate_limit_cron_notifications: { threshold: 10, windowMs: 10 * 60 * 1000 },
};

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

function toMetaDimension(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "unknown";
}

function maybeEmitSecurityAlert(event: string, meta?: LogMeta) {
  const rule = securityAlertRules[event];

  if (!rule) {
    return;
  }

  const route = toMetaDimension(meta?.route);
  const ipAddress = toMetaDimension(meta?.ipAddress);
  const userId = toMetaDimension(meta?.userId);
  const counterKey = `${event}:${route}:${ipAddress}:${userId}`;
  const now = Date.now();
  const current = securityAlertCounters.get(counterKey);

  if (!current || now - current.windowStartedAt > rule.windowMs) {
    securityAlertCounters.set(counterKey, {
      count: 1,
      windowStartedAt: now,
    });
    return;
  }

  current.count += 1;
  securityAlertCounters.set(counterKey, current);

  if (current.count < rule.threshold) {
    return;
  }

  const alertCooldownMs = rule.windowMs;
  if (current.lastAlertAt && now - current.lastAlertAt < alertCooldownMs) {
    return;
  }

  current.lastAlertAt = now;
  securityAlertCounters.set(counterKey, current);

  writeLog("error", `security:alert_triggered:${event}`, {
    event,
    count: current.count,
    threshold: rule.threshold,
    windowMs: rule.windowMs,
    route: meta?.route,
    ipAddress: meta?.ipAddress,
    userId: meta?.userId,
  });
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
  maybeEmitSecurityAlert(event, meta);
}
