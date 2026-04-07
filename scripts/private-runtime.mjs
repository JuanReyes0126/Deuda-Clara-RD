import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

import { loadProjectEnv } from "./load-env.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(projectRoot, ".runtime");
const pidFile = path.join(runtimeDir, "private-app.local.pid");
const metaFile = path.join(runtimeDir, "private-app.local.json");
const logFile = path.join(runtimeDir, "private-app.local.log");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const resolvedEnv = loadProjectEnv(projectRoot);

const host = resolvedEnv.APP_HOST || "127.0.0.1";
const port = resolvedEnv.APP_PORT || "3000";
const appUrl = resolvedEnv.APP_URL || `http://${host}:${port}`;
const demoModeEnabled = resolvedEnv.DEMO_MODE_ENABLED ?? "false";
const command = process.argv[2] || "status";

function ensureRuntimeDir() {
  mkdirSync(runtimeDir, { recursive: true });
}

function readPid() {
  if (!existsSync(pidFile)) {
    return null;
  }

  const raw = readFileSync(pidFile, "utf8").trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRunning(pid) {
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      return true;
    }

    return false;
  }
}

function findPortOwnerPid() {
  const result = spawnSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  const parsed = Number(result.stdout.trim().split("\n")[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanupRuntime() {
  if (existsSync(pidFile)) {
    rmSync(pidFile, { force: true });
  }

  if (existsSync(metaFile)) {
    rmSync(metaFile, { force: true });
  }
}

function readMeta() {
  if (!existsSync(metaFile)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(metaFile, "utf8"));
  } catch {
    return null;
  }
}

async function printStatus() {
  let pid = readPid();
  const meta = readMeta();
  const effectiveHost = meta?.host || host;
  const effectivePort = meta?.port || port;
  const recoveredPid = pid ? null : findPortOwnerPid();

  if (!pid && recoveredPid) {
    pid = recoveredPid;
    ensureRuntimeDir();
    writeFileSync(pidFile, String(pid));
    writeFileSync(
      metaFile,
      JSON.stringify(
        {
          pid,
          host,
          port,
          appUrl,
          demoModeEnabled,
          recoveredAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }

  if (!pid || !isRunning(pid)) {
    cleanupRuntime();
    console.log("Estado: detenido");
    console.log(`URL privada esperada: ${appUrl}`);
    console.log(`Logs: ${logFile}`);
    return;
  }

  const portActive = await isPortBusy(effectiveHost, effectivePort);

  if (!portActive) {
    cleanupRuntime();
    console.log("Estado: detenido");
    console.log(`PID anterior sin puerto activo: ${pid}`);
    console.log(`URL privada esperada: http://${effectiveHost}:${effectivePort}`);
    console.log(`Logs: ${logFile}`);
    return;
  }

  console.log("Estado: activo");
  console.log(`PID: ${pid}`);
  console.log(`URL privada: http://${effectiveHost}:${effectivePort}`);
  console.log(`APP_URL efectiva: ${meta?.appUrl || appUrl}`);
  console.log(`Modo demo por defecto: ${(meta?.demoModeEnabled || demoModeEnabled) === "true" ? "activo" : "inactivo"}`);
  console.log(`Logs: ${logFile}`);
}

function buildRuntimeEnv() {
  const safeEnv = { ...resolvedEnv };
  delete safeEnv.NODE_ENV;

  return {
    ...safeEnv,
    APP_HOST: host,
    APP_PORT: String(port),
    APP_URL: appUrl,
    DEMO_MODE_ENABLED: demoModeEnabled,
  };
}

function readLogTail(maxBytes = 4_000) {
  if (!existsSync(logFile)) {
    return "";
  }

  const size = statSync(logFile).size;
  const start = Math.max(size - maxBytes, 0);
  const buffer = readFileSync(logFile);
  return buffer.subarray(start).toString("utf8");
}

function isPortBusy(checkHost, checkPort) {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      {
        host: checkHost,
        port: Number(checkPort),
      },
      () => {
        socket.destroy();
        resolve(true);
      },
    );

    socket.setTimeout(800);
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function assertPortAvailable() {
  const busy = await isPortBusy(host, port);

  if (!busy) {
    return;
  }

  console.error(`El puerto ${port} en ${host} ya está ocupado.`);
  console.error(`Detén el proceso que lo usa o cambia el puerto, por ejemplo: APP_PORT=3001 npm run private:up`);
  process.exit(1);
}

function buildApp() {
  console.log("Compilando app para entorno privado...");
  const result = spawnSync(
    process.execPath,
    [nextBin, "build", "--webpack"],
    {
      cwd: projectRoot,
      env: buildRuntimeEnv(),
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function startApp({ rebuild }) {
  ensureRuntimeDir();

  const existingPid = readPid();

  if (existingPid && isRunning(existingPid)) {
    const meta = readMeta();
    console.log(`La app ya está activa en http://${meta?.host || host}:${meta?.port || port}`);
    return;
  }

  cleanupRuntime();
  await assertPortAvailable();

  if (rebuild) {
    buildApp();
  }

  let runtimePid = null;

  const outFd = openSync(logFile, "a");
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", host, "--port", String(port)],
    {
      cwd: projectRoot,
      env: buildRuntimeEnv(),
      detached: true,
      stdio: ["ignore", outFd, outFd],
    },
  );

  child.unref();
  runtimePid = child.pid;

  writeFileSync(pidFile, String(runtimePid));
  writeFileSync(
    metaFile,
    JSON.stringify(
      {
        pid: runtimePid,
        host,
        port,
        appUrl,
        demoModeEnabled,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const started = isRunning(runtimePid) && (await isPortBusy(host, port));

  if (!started) {
    cleanupRuntime();
    console.error("La app no logró quedarse levantada. Revisa el log:");
    console.error(logFile);
    const tail = readLogTail();
    if (tail) {
      console.error("\nÚltimas líneas del log:\n");
      console.error(tail);
    }
    process.exit(1);
  }

  console.log(`App privada activa en http://${host}:${port}`);
  console.log(`APP_URL efectiva: ${appUrl}`);
  console.log(`Modo demo por defecto: ${demoModeEnabled === "true" ? "activo" : "inactivo"}`);
  console.log(`PID: ${runtimePid}`);
  console.log(`Logs: ${logFile}`);
}

async function runDevServer(mode) {
  ensureRuntimeDir();
  await assertPortAvailable();

  console.log(
    mode === "dev"
      ? `Entorno privado local en caliente: ${appUrl}`
      : `Servidor privado compilado en primer plano: ${appUrl}`,
  );
  console.log(`Modo demo por defecto: ${demoModeEnabled === "true" ? "activo" : "inactivo"}`);
  console.log("Detén el proceso con Ctrl + C.");

  const child = spawn(
    process.execPath,
    [
      nextBin,
      mode === "dev" ? "dev" : "start",
      "--hostname",
      host,
      "--port",
      String(port),
      ...(mode === "dev" ? ["--webpack"] : []),
    ],
    {
      cwd: projectRoot,
      env: buildRuntimeEnv(),
      stdio: "inherit",
    },
  );

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

async function stopApp() {
  const pid = readPid() || findPortOwnerPid();

  if (!pid || !isRunning(pid)) {
    cleanupRuntime();
    console.log("No había un proceso privado activo.");
    return;
  }

  process.kill(pid, "SIGTERM");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isRunning(pid)) {
      cleanupRuntime();
      console.log("App privada detenida.");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  process.kill(pid, "SIGKILL");
  cleanupRuntime();
  console.log("App privada detenida por la fuerza.");
}

function showLogs() {
  if (!existsSync(logFile)) {
    console.log("Aún no hay logs en el entorno privado.");
    return;
  }

  const size = statSync(logFile).size;
  const maxBytes = 12_000;
  const start = Math.max(size - maxBytes, 0);
  const buffer = readFileSync(logFile);
  console.log(buffer.subarray(start).toString("utf8"));
}

switch (command) {
  case "up":
    await startApp({ rebuild: true });
    break;
  case "dev":
    await runDevServer("dev");
    break;
  case "start":
    await runDevServer("start");
    break;
  case "restart":
    await stopApp();
    await startApp({ rebuild: true });
    break;
  case "stop":
    await stopApp();
    break;
  case "status":
    await printStatus();
    break;
  case "logs":
    showLogs();
    break;
  default:
    console.log("Uso: node scripts/private-runtime.mjs <dev|start|up|restart|stop|status|logs>");
    process.exit(1);
}
