import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldUseSecureCookies } from "@/lib/security/cookie-options";

describe("cookie options", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("permite cookies no-secure en runtime productivo local sobre HTTP", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");

    expect(shouldUseSecureCookies()).toBe(false);
  });

  it("mantiene cookies secure en producción HTTPS", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://deudaclarard.com");

    expect(shouldUseSecureCookies()).toBe(true);
  });
});
