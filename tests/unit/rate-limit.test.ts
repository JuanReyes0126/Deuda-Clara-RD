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
});
