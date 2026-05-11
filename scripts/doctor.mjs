import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");
const envLocalPath = path.join(cwd, ".env.local");
const explicitEnvFiles = (process.env.ENV_FILE || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });

  return result.status === 0;
}

function resolveEnvFiles() {
  const defaultFiles = [envPath, envLocalPath];
  const selectedFiles = explicitEnvFiles.length
    ? [envPath, ...explicitEnvFiles.map((file) => path.join(cwd, file))]
    : defaultFiles;

  return [...new Set(selectedFiles)];
}

function readLocalEnv() {
  const files = resolveEnvFiles();

  if (!files.some((filePath) => fs.existsSync(filePath))) {
    return null;
  }

  return files.reduce((env, filePath) => {
    if (!fs.existsSync(filePath)) {
      return env;
    }

    return {
      ...env,
      ...parseEnvFile(fs.readFileSync(filePath, "utf8")),
    };
  }, {});
}

function checkValue(label, isValid, detail) {
  if (isValid) {
    console.log(`[ok] ${label}: ${detail}`);
    return true;
  }

  console.log(`[fail] ${label}: ${detail}`);
  return false;
}

function warnValue(label, isValid, detail) {
  if (isValid) {
    console.log(`[ok] ${label}: ${detail}`);
    return true;
  }

  console.log(`[warn] ${label}: ${detail}`);
  return false;
}

function summarizeMissingVars(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  return {
    ok: missing.length === 0,
    missing,
  };
}

function tcpCheck(host, port, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
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

console.log("Deuda Clara RD · Diagnóstico local");
console.log("");

if (explicitEnvFiles.length) {
  console.log(`Archivos de entorno evaluados: .env + ${explicitEnvFiles.join(", ")}`);
  console.log("");
}

const env = readLocalEnv();

if (!env) {
  console.log("[fail] .env: no existe .env ni .env.local. Crea uno con `cp .env.example .env`.");
  process.exit(1);
}

const requiredChecks = [
  ["APP_URL", Boolean(env.APP_URL), env.APP_URL ? env.APP_URL : "Falta APP_URL"],
  [
    "AUTH_SECRET",
    Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32),
    env.AUTH_SECRET
      ? `Longitud detectada: ${env.AUTH_SECRET.length}`
      : "Falta AUTH_SECRET de al menos 32 caracteres",
  ],
  [
    "DATA_ENCRYPTION_KEY",
    Boolean(env.DATA_ENCRYPTION_KEY && env.DATA_ENCRYPTION_KEY.length >= 24),
    env.DATA_ENCRYPTION_KEY
      ? `Longitud detectada: ${env.DATA_ENCRYPTION_KEY.length}`
      : "Falta DATA_ENCRYPTION_KEY de al menos 24 caracteres",
  ],
  ["DATABASE_URL", Boolean(env.DATABASE_URL), env.DATABASE_URL ? "Configurada" : "Falta DATABASE_URL"],
  [
    "DIRECT_DATABASE_URL",
    Boolean(env.DIRECT_DATABASE_URL),
    env.DIRECT_DATABASE_URL ? "Configurada" : "Falta DIRECT_DATABASE_URL",
  ],
];

let allRequiredOk = true;

for (const [label, isValid, detail] of requiredChecks) {
  allRequiredOk = checkValue(label, isValid, detail) && allRequiredOk;
}

let databaseReachable = false;

if (env.DATABASE_URL) {
  try {
    const databaseUrl = new URL(env.DATABASE_URL);
    const host = databaseUrl.hostname;
    const port = Number(databaseUrl.port || "5432");
    databaseReachable = await tcpCheck(host, port);

    checkValue(
      "PostgreSQL",
      databaseReachable,
      databaseReachable
        ? `Responde en ${host}:${port}`
        : `No responde en ${host}:${port}`,
    );
  } catch {
    allRequiredOk = checkValue(
      "DATABASE_URL",
      false,
      "La URL de base de datos no tiene un formato válido.",
    ) && allRequiredOk;
  }
}

let appReachable = false;

if (env.APP_URL) {
  try {
    const appUrl = new URL(env.APP_URL);
    const host = appUrl.hostname;
    const port = Number(appUrl.port || (appUrl.protocol === "https:" ? "443" : "80"));
    appReachable = await tcpCheck(host, port, 1500);

    checkValue(
      "Aplicación",
      appReachable,
      appReachable ? `Responde en ${env.APP_URL}` : `No está levantada en ${env.APP_URL}`,
    );
  } catch {
    allRequiredOk = checkValue("APP_URL", false, "La URL de la aplicación no es válida.") && allRequiredOk;
  }
}

console.log("");
console.log("Herramientas locales");
warnValue("Docker", commandExists("docker"), commandExists("docker") ? "Disponible" : "No disponible");
warnValue(
  "PostgreSQL CLI",
  commandExists("psql"),
  commandExists("psql") ? "Disponible" : "No disponible",
);

console.log("");
console.log("Servicios opcionales para lanzamiento");
const resendSummary = summarizeMissingVars(env, [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
]);
warnValue(
  "Email transaccional",
  resendSummary.ok,
  resendSummary.ok
    ? "Resend configurado"
    : `Faltan: ${resendSummary.missing.join(", ")}`,
);
const azulSummary = summarizeMissingVars(env, [
  "BILLING_PROVIDER",
  "AZUL_PAYMENT_URL",
  "AZUL_MERCHANT_ID",
  "AZUL_MERCHANT_NAME",
  "AZUL_MERCHANT_TYPE",
  "AZUL_AUTH_KEY",
  "AZUL_CURRENCY_CODE",
]);
warnValue(
  "AZUL",
  azulSummary.ok && env.BILLING_PROVIDER === "AZUL",
  azulSummary.ok && env.BILLING_PROVIDER === "AZUL"
    ? "AZUL configurado para probar checkout de membresías"
    : azulSummary.missing.length
      ? `Faltan: ${azulSummary.missing.join(", ")}`
      : "BILLING_PROVIDER debe ser AZUL.",
);
const passkeySummary = summarizeMissingVars(env, [
  "PASSKEY_RP_ID",
  "PASSKEY_RP_NAME",
  "PASSKEY_ALLOWED_ORIGINS",
]);
warnValue(
  "Passkeys",
  passkeySummary.ok,
  passkeySummary.ok
    ? "Passkeys configuradas para el dominio actual"
    : `Faltan: ${passkeySummary.missing.join(", ")}`,
);
const redisSummary = summarizeMissingVars(env, [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
]);
warnValue(
  "Rate limit persistente",
  redisSummary.ok,
  redisSummary.ok
    ? "Upstash Redis configurado"
    : `Faltan: ${redisSummary.missing.join(", ")}`,
);
warnValue(
  "CRON_SECRET",
  Boolean(env.CRON_SECRET && env.CRON_SECRET.length >= 24),
  env.CRON_SECRET
    ? "Listo para ejecutar job de recordatorios"
    : "Si falta, no podrás disparar el job protegido de notificaciones.",
);
checkValue(
  "Host panel",
  env.HOST_PANEL_ENABLED === "true"
    ? Boolean(env.HOST_ALLOWED_EMAILS)
    : true,
  env.HOST_PANEL_ENABLED === "true"
    ? env.HOST_ALLOWED_EMAILS
      ? "Panel interno habilitado con allowlist"
      : "Si habilitas el panel interno, configura HOST_ALLOWED_EMAILS."
    : "Deshabilitado en este entorno",
);
checkValue(
  "Host secondary protection",
  env.HOST_PANEL_ENABLED === "true"
    ? Boolean(env.HOST_SECONDARY_TOTP_SECRET || env.HOST_SECONDARY_PASSWORD)
    : true,
  env.HOST_PANEL_ENABLED === "true"
    ? env.HOST_SECONDARY_TOTP_SECRET
      ? "Capa secundaria configurada con TOTP"
      : env.HOST_SECONDARY_PASSWORD
        ? "Capa secundaria configurada con contraseña"
        : "Falta capa secundaria de acceso para el panel interno."
    : "No aplica mientras el panel interno esté deshabilitado",
);

console.log("");
console.log("Siguientes pasos recomendados");

if (!databaseReachable) {
  console.log("- Levanta PostgreSQL. Si usas Docker Desktop: `docker-compose up --build`.");
  console.log("- Si no usas Docker, instala PostgreSQL 16 local y apunta `.env` a esa base.");
}

if (databaseReachable && !appReachable) {
  console.log("- Ejecuta `npm run dev` y abre `http://localhost:3000/registro`.");
}

if (databaseReachable && appReachable) {
  console.log("- La app ya puede probar registro real en `/registro`.");
  console.log("- También puedes revisar salud en `/api/health`.");
}

if (!(azulSummary.ok && env.BILLING_PROVIDER === "AZUL")) {
  console.log(
    `- Completa billing antes de cobrar membresías: ${
      azulSummary.missing.length ? azulSummary.missing.join(", ") : "BILLING_PROVIDER=AZUL"
    }.`,
  );
}

if (!resendSummary.ok) {
  console.log(`- Completa email transaccional: ${resendSummary.missing.join(", ")}.`);
}

if (!passkeySummary.ok) {
  console.log(`- Completa passkeys antes de lanzar: ${passkeySummary.missing.join(", ")}.`);
}

if (!redisSummary.ok) {
  console.log(`- Configura Upstash antes de producción: ${redisSummary.missing.join(", ")}.`);
}

if (env.HOST_PANEL_ENABLED === "true" && !env.HOST_ALLOWED_EMAILS) {
  console.log("- Si vas a usar el panel interno, define HOST_ALLOWED_EMAILS con correos permitidos.");
}

console.log("- Credenciales QA del seed: `demo@deudaclarard.com / DeudaClara123!`.");
console.log("- Si estás probando auth muchas veces en local, puedes dejar `SKIP_RATE_LIMIT_IN_DEV=true`.");

if (!allRequiredOk || !databaseReachable) {
  process.exitCode = 1;
}
