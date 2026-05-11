import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, "utf8");
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    result[key] = parseEnvValue(value);
  }

  return result;
}

function resolveEnvFiles(projectRoot) {
  const explicitEnvFiles = (process.env.ENV_FILE || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((file) => path.join(projectRoot, file));

  const defaultFiles = [
    path.join(projectRoot, ".env"),
    path.join(projectRoot, ".env.local"),
  ];

  const selectedFiles = explicitEnvFiles.length
    ? [path.join(projectRoot, ".env"), ...explicitEnvFiles]
    : defaultFiles;

  return [...new Set(selectedFiles)];
}

export function loadProjectEnv(projectRoot) {
  const envFiles = resolveEnvFiles(projectRoot);

  return envFiles.reduce(
    (env, filePath) => ({
      ...env,
      ...parseEnvFile(filePath),
    }),
    {},
  );
}

export function getLoadedEnvFiles(projectRoot) {
  return resolveEnvFiles(projectRoot).filter((filePath) => existsSync(filePath));
}
