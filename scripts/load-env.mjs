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

export function loadProjectEnv(projectRoot) {
  const baseEnv = parseEnvFile(path.join(projectRoot, ".env"));
  const localEnv = parseEnvFile(path.join(projectRoot, ".env.local"));

  return {
    ...baseEnv,
    ...localEnv,
    ...process.env,
  };
}
