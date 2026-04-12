import type { NextRequest } from "next/server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { getServerEnv } from "@/lib/env/server";
import { getRequestMeta } from "@/lib/security/request-meta";
import { logServerError } from "@/server/observability/logger";

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getUpstashLimiter(input: RateLimitInput, env = getServerEnv()) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  return new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(
      input.limit,
      `${Math.max(1, Math.ceil(input.windowMs / 1000))} s`,
    ),
  });
}

export async function assertRateLimit(input: RateLimitInput) {
  const env = getServerEnv();

  if (env.NODE_ENV === "development" && process.env.SKIP_RATE_LIMIT_IN_DEV !== "false") {
    return {
      success: true,
      remaining: input.limit,
      resetAt: Date.now() + input.windowMs,
    };
  }

  const limiter = getUpstashLimiter(input, env);

  if (limiter) {
    try {
      const result = await limiter.limit(input.key);

      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (error) {
      logServerError("Upstash rate limit failed, falling back to memory store", {
        error,
        rateLimitKey: input.key,
      });
    }
  }

  const now = Date.now();
  const entry = memoryStore.get(input.key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    });

    return {
      success: true,
      remaining: input.limit - 1,
      resetAt: now + input.windowMs,
    };
  }

  if (entry.count >= input.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  memoryStore.set(input.key, entry);

  return {
    success: true,
    remaining: Math.max(0, input.limit - entry.count),
    resetAt: entry.resetAt,
  };
}

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, "-").slice(0, 120);
}

export function buildRateLimitKey(
  request: NextRequest,
  namespace: string,
  ...parts: Array<string | undefined | null>
) {
  const { ipAddress } = getRequestMeta(request);

  return [namespace, ipAddress ?? "unknown", ...parts.filter(Boolean).map((part) => normalizeKeyPart(part!))].join(":");
}

export function getRetryAfterSeconds(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}
