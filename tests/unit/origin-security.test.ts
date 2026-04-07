import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "@/lib/security/csrf";
import { assertSameOriginWithOptions } from "@/lib/security/origin";
import { ServiceError } from "@/server/services/service-error";

const csrfToken = "unit-csrf-token";

function buildPostRequest(input: {
  url: string;
  host: string;
  origin: string;
}) {
  return new NextRequest(input.url, {
    method: "POST",
    headers: {
      cookie: `${CSRF_COOKIE_NAME}=${csrfToken}`,
      host: input.host,
      origin: input.origin,
      [CSRF_HEADER_NAME]: csrfToken,
    },
    body: "{}",
  });
}

describe("origin security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no confía en el header Host como origen permitido en producción", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://app.deudaclara.test");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/app");
    vi.stubEnv("DATA_ENCRYPTION_KEY", "x".repeat(32));
    vi.stubEnv("DEMO_MODE_ENABLED", "false");

    const request = buildPostRequest({
      url: "https://app.deudaclara.test/api/billing/checkout",
      host: "evil.example",
      origin: "https://evil.example",
    });

    expect(() => assertSameOriginWithOptions(request)).toThrow(ServiceError);
  });

  it("mantiene orígenes derivados del host en desarrollo local", () => {
    vi.stubEnv("NODE_ENV", "development");

    const request = buildPostRequest({
      url: "http://127.0.0.1:3000/api/billing/checkout",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
    });

    expect(() => assertSameOriginWithOptions(request)).not.toThrow();
  });
});
