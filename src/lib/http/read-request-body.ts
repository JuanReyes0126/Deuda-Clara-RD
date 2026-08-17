import type { NextRequest } from "next/server";

export async function readRequestBody(
  request: NextRequest,
): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await request.json()) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [key, String(value ?? "")]),
    );
  }

  const formData = await request.formData();

  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}
