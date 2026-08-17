export type AuthResponsePayload = {
  error?: string;
  mfaRequired?: boolean;
  redirectTo?: string;
};

export async function readAuthResponse(response: Response): Promise<AuthResponsePayload> {
  try {
    return (await response.json()) as AuthResponsePayload;
  } catch {
    return {};
  }
}
