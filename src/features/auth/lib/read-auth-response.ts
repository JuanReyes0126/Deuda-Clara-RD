export type AuthResponsePayload = {
  error?: string;
  redirectTo?: string;
};

export async function readAuthResponse(response: Response): Promise<AuthResponsePayload> {
  try {
    return (await response.json()) as AuthResponsePayload;
  } catch {
    return {};
  }
}
