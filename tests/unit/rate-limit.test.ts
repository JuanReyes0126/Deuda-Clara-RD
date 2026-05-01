import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const ratelimitConstructor = vi.fn(function MockRatelimit() {
  return {
    limit: limitMock,
  };
});
const slidingWindowMock = vi.fn(() => "window");
const redisConstructor = vi.fn(function MockRedis() {});
const logServerErrorMock = vi.fn();
const getServerEnvMock = vi.fn();

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(ratelimitConstructor, {
    slidingWindow: slidingWindowMock,
  }),
}));

vi.mock("@upstash/redis", () => ({
  Redis: redisConstructor,
}));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: getServerEnvMock,
}));

vi.mock("@/server/observability/logger", () => ({
  logServerError: logServerErrorMock,
}));

describe("rate limit fallback", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.resetModules();
    limitMock.mockReset();
    ratelimitConstructor.mockClear();
    slidingWindowMock.mockClear();
    redisConstructor.mockClear();
    logServerErrorMock.mockReset();
    getServerEnvMock.mockReset();
    getServerEnvMock.mockReturnValue({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://upstash.example",
      UPSTASH_REDIS_REST_TOKEN: "token",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa fallback en memoria si Upstash falla", async () => {
    limitMock.mockRejectedValueOnce(new Error("upstash down"));

    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const result = await assertRateLimit({
      key: "login:test@example.com",
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(logServerErrorMock).toHaveBeenCalledWith(
      "Upstash rate limit failed, falling back to memory store",
      expect.objectContaining({
        rateLimitKey: "login:test@example.com",
      }),
    );
  });

  it("bloquea si la ruta exige store distribuido y Upstash falla", async () => {
    limitMock.mockRejectedValueOnce(new Error("upstash down"));

    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const result = await assertRateLimit({
      key: "login:test@example.com",
      limit: 5,
      windowMs: 60_000,
      requireDistributedStore: true,
    });

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("usa fallback en memoria si Upstash falla al inicializar", async () => {
    redisConstructor.mockImplementationOnce(() => {
      throw new Error("invalid upstash config");
    });

    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const result = await assertRateLimit({
      key: "login:admin@deudaclarard.com",
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(logServerErrorMock).toHaveBeenCalledWith(
      "Upstash rate limit initialization failed, falling back to memory store",
      expect.objectContaining({
        rateLimitKey: "login:admin@deudaclarard.com",
      }),
    );
  });

  it("bloquea si la ruta exige store distribuido y Upstash no esta configurado", async () => {
    getServerEnvMock.mockReturnValueOnce({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });

    const { assertRateLimit } = await import("@/lib/security/rate-limit");
    const result = await assertRateLimit({
      key: "login:admin@deudaclarard.com",
      limit: 5,
      windowMs: 60_000,
      requireDistributedStore: true,
    });

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(logServerErrorMock).toHaveBeenCalledWith(
      "Distributed rate limit store unavailable for strict route",
      expect.objectContaining({
        rateLimitKey: "login:admin@deudaclarard.com",
      }),
    );
  });
});
