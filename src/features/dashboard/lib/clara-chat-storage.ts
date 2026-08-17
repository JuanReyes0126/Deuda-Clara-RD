const STORAGE_KEY_PREFIX = "deuda-clara:clara-chat:v1:";
const MAX_SERIALIZED_LENGTH = 4_500_000;

export function getClaraChatStorageKey(storageKey: string) {
  return `${STORAGE_KEY_PREFIX}${storageKey}`;
}

export function readClaraChatRaw(storageKey: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(getClaraChatStorageKey(storageKey));
  } catch {
    return null;
  }
}

export function writeClaraChatRaw(storageKey: string, json: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (json.length > MAX_SERIALIZED_LENGTH) {
    return;
  }

  try {
    window.localStorage.setItem(getClaraChatStorageKey(storageKey), json);
  } catch {
    // Quota or private mode — ignore
  }
}
