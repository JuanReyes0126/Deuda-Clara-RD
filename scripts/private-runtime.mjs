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

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(projectRoot, ".runtime");
const pidFile = path.join(runtimeDir, "private-app.pid");
const metaFile = path.join(runtimeDir, "private-app.json");
const logFile = path.join(runtimeDir, "private-app.log");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const host = process.env.APP_HOST || "127.0.0.1";
const port = process.env.APP_PORT || "3000";
const appUrl = process.env.APP_URL || `http://${host}:${port}`;
const demoModeEnabled = process.env.DEMO_MODE_ENABLED ?? "true";
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
  } catch {
    return false;
  }
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

function printStatus() {
  const pid = readPid();

  if (!pid || !isRunning(pid)) {
    cleanupRuntime();
    console.log("Estado: detenido");
    console.log(`URL privada esperada: ${appUrl}`);
    console.log(`Logs: ${logFile}`);
    return;
  }

  const meta = readMeta();
  console.log("Estado: activo");
  console.log(`PID: ${pid}`);
  console.log(`URL privada: http://${meta?.host || host}:${meta?.port || port}`);
  console.log(`APP_URL efectiva: ${meta?.appUrl || appUrl}`);
  console.log(`Modo demo por defecto: ${(meta?.demoModeEnabled || demoModeEnabled) === "true" ? "activo" : "inactivo"}`);
  console.log(`Logs: ${logFile}`);
}

function buildRuntimeEnv() {
  return {
    ...process.env,
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

  if (process.platform === "win32") {
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
  } else {
    const quotedNode = JSON.stringify(process.execPath);
    const quotedNext = JSON.stringify(nextBin);
    const quotedHost = JSON.stringify(host);
    const quotedPort = JSON.stringify(String(port));
    const quotedLog = JSON.stringify(logFile);
    const commandLine = `nohup ${quotedNode} ${quotedNext} start --hostname ${quotedHost} --port ${quotedPort} >> ${quotedLog} 2>&1 & echo $!`;
    const result = spawnSync("sh", ["-lc", commandLine], {
      cwd: projectRoot,
      env: buildRuntimeEnv(),
      encoding: "utf8",
    });

    if (result.status !== 0) {
      console.error(result.stderr || "No se pudo iniciar la app privada.");
      process.exit(result.status ?? 1);
    }

    const parsedPid = Number(result.stdout.trim().split(/\s+/).pop());

    if (!Number.isFinite(parsedPid)) {
      console.error("No se pudo capturar el PID de la app privada.");
      process.exit(1);
    }

    runtimePid = parsedPid;
  }

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

  if (!isRunning(runtimePid)) {
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
  const pid = readPid();

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
    printStatus();
    break;
  case "logs":
    showLogs();
    break;
  default:
    console.log("Uso: node scripts/private-runtime.mjs <dev|start|up|restart|stop|status|logs>");
    process.exit(1);
}
