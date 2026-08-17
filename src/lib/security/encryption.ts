import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_PREFIX = "enc:v1";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function getEncryptionSecret() {
  const secret =
    process.env.DATA_ENCRYPTION_KEY ??
    (process.env.NODE_ENV === "production" ? undefined : process.env.AUTH_SECRET);

  if (!secret || secret.length < 24) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DATA_ENCRYPTION_KEY must be configured with at least 24 characters in production.",
      );
    }

    return null;
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSensitiveText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue.length) {
    return null;
  }

  if (normalizedValue.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalizedValue;
  }

  const secret = getEncryptionSecret();

  if (!secret) {
    return normalizedValue;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, secret, iv);
  const encrypted = Buffer.concat([cipher.update(normalizedValue, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSensitiveText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return value;
  }

  const secret = getEncryptionSecret();

  if (!secret) {
    return null;
  }

  const [, version, iv, authTag, encrypted] = value.split(":");

  if (version !== "v1" || !iv || !authTag || !encrypted) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      secret,
      Buffer.from(iv, "base64"),
    );

    decipher.setAuthTag(Buffer.from(authTag, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
