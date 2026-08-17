export async function readJsonPayload<T extends Record<string, unknown>>(
  response: Response,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}
