import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");

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
  if (!fs.existsSync(envPath)) {
    return null;
  }

  return parseEnvFile(fs.readFileSync(envPath, "utf8"));
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

console.log("Deuda Clara RD · Pre-beta cerrada");
console.log("");

const env = readLocalEnv();

if (!env) {
  printStatus("fail", ".env", "No existe. Crea uno con `cp .env.example .env`.");
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
  "Desactivado. Correcto para beta real.",
  "Sigue en `true`. Para amigos reales conviene usar `false` y trabajar con base persistente.",
);

if (env.APP_URL) {
  const publicAppUrl = !isLocalAppUrl(env.APP_URL);

  requireCheck(
    publicAppUrl,
    "APP_URL pública",
    publicAppUrl
      ? `Lista para compartir: ${env.APP_URL}`
      : `Todavía apunta a local: ${env.APP_URL}`,
  );

  warnCheck(
    env.APP_URL.startsWith("https://"),
    "HTTPS",
    "La URL usa HTTPS.",
    "La URL no usa HTTPS. Para beta cerrada real es mejor compartir bajo HTTPS.",
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
        "Stripe",
        `Billing listo en modo ${health.payload.environment.billingMode}.`,
        "Sin Stripe listo. Puedes correr beta funcional, pero no cobrar Premium/Pro.",
      );
    }
  }
}

console.log("");
console.log("Recomendación de salida");

if (failures === 0) {
  console.log("- El entorno está suficientemente listo para una beta cerrada con 5 o 6 personas.");
  console.log("- Siguiente paso: invitar testers, observar registro -> primera deuda -> primer pago -> simulador.");
} else {
  console.log("- Todavía no abriría la beta. Corrige primero los checks marcados como fail.");
}

if (warnings > 0) {
  console.log("- También conviene revisar los warnings antes de compartir el enlace ampliamente.");
}

console.log("");
console.log("Sugerencia de prueba con amigos");
console.log("- Pídeles 20 a 30 minutos.");
console.log("- Enfócalos en: registro, primera deuda, primer pago, simulador y plan recomendado.");
console.log("- Pídeles que te manden 3 cosas: qué entendieron rápido, dónde dudaron, y qué los frenó.");

if (failures > 0) {
  process.exitCode = 1;
}
