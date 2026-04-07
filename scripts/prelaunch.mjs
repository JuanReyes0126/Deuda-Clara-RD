import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const envLocalPath = path.join(cwd, ".env.local");

function parseEnvFile(raw) {
  const env = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function readLocalEnv() {
  if (!fs.existsSync(envPath) && !fs.existsSync(envLocalPath)) {
    return null;
  }

  return [envPath, envLocalPath].reduce((env, filePath) => {
    if (!fs.existsSync(filePath)) {
      return env;
    }

    return {
      ...env,
      ...parseEnvFile(fs.readFileSync(filePath, "utf8")),
    };
  }, {});
}

function isLocalAppUrl(value) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function printStatus(kind, label, detail) {
  console.log(`[${kind}] ${label}: ${detail}`);
}

async function healthCheck(appUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(new URL("/api/health", appUrl), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    return {
      reachable: true,
      ok: response.ok,
      status: response.status,
      payload,
    };
  } catch {
    return {
      reachable: false,
      ok: false,
      status: 0,
      payload: null,
    };
  }
}

console.log("Deuda Clara RD · Release candidate");
console.log("");

const env = readLocalEnv();

if (!env) {
  printStatus("fail", ".env", "No existe .env ni .env.local. Crea uno con `cp .env.example .env`.");
  process.exit(1);
}

let failures = 0;
let warnings = 0;

function requireCheck(condition, label, detail) {
  if (condition) {
    printStatus("ok", label, detail);
    return;
  }

  failures += 1;
  printStatus("fail", label, detail);
}

function warnCheck(condition, label, detailIfOk, detailIfWarn) {
  if (condition) {
    printStatus("ok", label, detailIfOk);
    return;
  }

  warnings += 1;
  printStatus("warn", label, detailIfWarn);
}

requireCheck(Boolean(env.APP_URL), "APP_URL", env.APP_URL || "Falta APP_URL.");
requireCheck(
  Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32),
  "AUTH_SECRET",
  env.AUTH_SECRET
    ? `Longitud detectada: ${env.AUTH_SECRET.length}`
    : "Debe tener al menos 32 caracteres.",
);
requireCheck(
  Boolean(env.DATA_ENCRYPTION_KEY && env.DATA_ENCRYPTION_KEY.length >= 24),
  "DATA_ENCRYPTION_KEY",
  env.DATA_ENCRYPTION_KEY
    ? `Longitud detectada: ${env.DATA_ENCRYPTION_KEY.length}`
    : "Debe tener al menos 24 caracteres.",
);
requireCheck(
  Boolean(env.DATABASE_URL),
  "DATABASE_URL",
  env.DATABASE_URL ? "Configurada" : "Falta DATABASE_URL.",
);
requireCheck(
  Boolean(env.DIRECT_DATABASE_URL),
  "DIRECT_DATABASE_URL",
  env.DIRECT_DATABASE_URL
    ? "Configurada"
    : "Falta DIRECT_DATABASE_URL. Prisma la usa para conexión directa y migraciones.",
);
requireCheck(
  Boolean(env.CRON_SECRET && env.CRON_SECRET.length >= 24),
  "CRON_SECRET",
  env.CRON_SECRET
    ? `Longitud detectada: ${env.CRON_SECRET.length}`
    : "Debe tener al menos 24 caracteres.",
);

warnCheck(
  env.DEMO_MODE_ENABLED === "false",
  "DEMO_MODE_ENABLED",
  "Desactivado. Correcto para lanzamiento.",
  "Sigue en `true`. Para lanzamiento debe usar `false` y trabajar con base persistente.",
);

if (env.APP_URL) {
  const publicAppUrl = !isLocalAppUrl(env.APP_URL);

  warnCheck(
    publicAppUrl,
    "APP_URL pública",
    publicAppUrl
      ? `Lista para compartir: ${env.APP_URL}`
      : "URL pública configurada.",
    publicAppUrl
      ? "URL pública configurada."
      : "Usando URL local para QA. En producción debe apuntar al dominio público.",
  );

  warnCheck(
    env.APP_URL.startsWith("https://"),
    "HTTPS",
    "La URL usa HTTPS.",
    publicAppUrl
      ? "La URL pública no usa HTTPS. Corrige antes de producción."
      : "QA local sin HTTPS. Producción debe usar HTTPS.",
  );

  const health = await healthCheck(env.APP_URL);

  requireCheck(
    health.reachable,
    "Reachability",
    health.reachable
      ? `La app responde en ${env.APP_URL}`
      : `No se pudo abrir ${env.APP_URL}`,
  );

  if (health.reachable) {
    requireCheck(
      health.ok,
      "Health endpoint",
      health.ok
        ? `/api/health respondió ${health.status}`
        : `/api/health respondió ${health.status}`,
    );

    if (health.payload?.database) {
      requireCheck(
        Boolean(health.payload.database.ok),
        "Database health",
        health.payload.database.message ?? "Sin detalle.",
      );
    }

    if (health.payload?.auth) {
      requireCheck(
        Boolean(health.payload.auth.ready),
        "Auth health",
        health.payload.auth.ready
          ? "Auth y sesiones listas."
          : "Auth no está lista todavía.",
      );
    }

    if (health.payload?.environment?.ok) {
      warnCheck(
        Boolean(health.payload.environment.emailReady),
        "Email transaccional",
        "Resend configurado.",
        "Sin Resend. La beta puede operar, pero sin correos reales.",
      );

      warnCheck(
        Boolean(health.payload.environment.billingReady),
        "AZUL",
        `Billing listo en modo ${health.payload.environment.billingMode}.`,
        "AZUL no está listo. Puedes validar producto, pero no cobrar Premium/Pro.",
      );
    }
  }
}

console.log("");
console.log("Recomendación de salida");

if (failures === 0) {
  console.log("- El entorno está suficientemente listo para QA final de release candidate.");
  console.log("- Siguiente paso: validar mobile real, AZUL sandbox y go/no-go de producción.");
} else {
  console.log("- Todavía no abriría producción. Corrige primero los checks marcados como fail.");
}

if (warnings > 0) {
  console.log("- Revisa los warnings antes de compartir el enlace públicamente.");
}

console.log("");
console.log("Foco de QA final");
console.log("- Mobile: dashboard, deudas, pagos, simulador y planes.");
console.log("- Billing: checkout AZUL aprobado, declinado y cancelado.");
console.log("- Seguridad: auth, CSRF, MFA/admin, host panel y cron.");

if (failures > 0) {
  process.exitCode = 1;
}
