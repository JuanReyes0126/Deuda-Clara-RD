import { NextRequest } from "next/server";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from "@/lib/security/csrf";

const CSRF_TEST_TOKEN = "test-csrf-token";

export function buildJsonRequest(
  url: string,
  body: unknown,
  options?: {
    headers?: Record<string, string>;
    method?: "DELETE" | "PATCH" | "POST";
  },
) {
  const headers = {
    "content-type": "application/json",
    cookie: `${CSRF_COOKIE_NAME}=${CSRF_TEST_TOKEN}`,
    host: "localhost",
    origin: "http://localhost",
    [CSRF_HEADER_NAME]: CSRF_TEST_TOKEN,
    ...options?.headers,
  };

  return new NextRequest(url, {
    method: options?.method ?? "POST",
    headers,
    body: JSON.stringify(body),
  });
}
