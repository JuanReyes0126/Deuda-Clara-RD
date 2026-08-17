import { hash, verify } from "@node-rs/argon2";

const passwordConfig = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string) {
  return hash(password, passwordConfig);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return verify(hashedPassword, password, passwordConfig);
}
