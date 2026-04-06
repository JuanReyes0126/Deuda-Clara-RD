import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOTP_ALGORITHM = "sha1";
const TOTP_DIGITS = 6;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32Secret(value: Buffer) {
  let bits = "";
  let encoded = "";

  for (const byte of value) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    encoded += base32Alphabet[Number.parseInt(chunk, 2)] ?? "";
  }

  return encoded;
}

function decodeBase32Secret(secret: string) {
  const normalizedSecret = secret
    .replace(/[\s=]/g, "")
    .toUpperCase();

  let bits = "";
  const bytes: number[] = [];

  for (const character of normalizedSecret) {
    const value = base32Alphabet.indexOf(character);

    if (value === -1) {
      return null;
    }

    bits += value.toString(2).padStart(5, "0");
  }

  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateTotpCode(secretKey: Buffer, timeStep: number) {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(timeStep / 2 ** 32), 0);
  counter.writeUInt32BE(timeStep >>> 0, 4);

  const digest = createHmac(TOTP_ALGORITHM, secretKey)
    .update(counter)
    .digest();
  const offset = (digest.at(-1) ?? 0) & 0x0f;
  const binaryCode =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return String(binaryCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(secret: string, code: string) {
  const secretKey = decodeBase32Secret(secret);
  const normalizedCode = code.trim();

  if (!secretKey || !/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  const candidateBuffer = Buffer.from(normalizedCode);

  for (let windowOffset = -TOTP_WINDOW; windowOffset <= TOTP_WINDOW; windowOffset += 1) {
    const expectedCode = generateTotpCode(secretKey, currentStep + windowOffset);
    const expectedBuffer = Buffer.from(expectedCode);

    if (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    ) {
      return true;
    }
  }

  return false;
}

export function createTotpSecret() {
  return encodeBase32Secret(randomBytes(20));
}

export function buildTotpProvisioningUri(input: {
  accountName: string;
  issuer?: string;
  secret: string;
}) {
  const issuer = input.issuer ?? "Deuda Clara RD";
  const accountLabel = encodeURIComponent(`${issuer}:${input.accountName}`);
  const issuerLabel = encodeURIComponent(issuer);

  return `otpauth://totp/${accountLabel}?secret=${input.secret}&issuer=${issuerLabel}&algorithm=SHA1&digits=6&period=30`;
}

function normalizeRecoveryCode(code: string) {
  return code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function createRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

export function verifyRecoveryCode(
  code: string,
  hashedCodes: readonly string[],
) {
  const normalizedCode = normalizeRecoveryCode(code);

  if (!normalizedCode.length) {
    return { matched: false, remainingHashes: [...hashedCodes] };
  }

  const candidateHash = createHash("sha256").update(normalizedCode).digest("hex");
  const matched = hashedCodes.includes(candidateHash);

  return {
    matched,
    remainingHashes: matched
      ? hashedCodes.filter((item) => item !== candidateHash)
      : [...hashedCodes],
  };
}
