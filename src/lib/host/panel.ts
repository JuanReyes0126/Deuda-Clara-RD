export const HOST_PANEL_ROUTE = "/host";
export const HOST_PANEL_UNLOCK_ROUTE = "/host/unlock";
export const HOST_PANEL_SESSION_COOKIE = "dc_session";
export const HOST_PANEL_GATE_COOKIE = "dc_host_gate";

export function isHostPanelEnabledFlag(value: string | boolean | undefined) {
  return value === true || value === "true";
}

export function normalizeHostEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseHostAllowedEmails(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => normalizeHostEmail(email))
      .filter(Boolean),
  );
}
