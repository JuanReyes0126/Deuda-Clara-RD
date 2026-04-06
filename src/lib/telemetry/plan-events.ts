"use client";

import { fetchWithCsrf } from "@/lib/http/fetch-with-csrf";

export type PlanTelemetryEvent =
  | "upgrade_click"
  | "feature_blocked"
  | "simulator_used"
  | "debt_limit_hit"
  | "premium_preview_seen";

function buildTelemetryDedupKey(
  event: PlanTelemetryEvent,
  meta: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return null;
  }

  if (event !== "simulator_used" && event !== "premium_preview_seen") {
    return null;
  }

  return `dc-plan-event:${event}:${window.location.pathname}:${JSON.stringify(meta)}`;
}

export function trackPlanEvent(
  event: PlanTelemetryEvent,
  meta: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const dedupeKey = buildTelemetryDedupKey(event, meta);

  if (dedupeKey && window.sessionStorage.getItem(dedupeKey)) {
    return;
  }

  if (dedupeKey) {
    window.sessionStorage.setItem(dedupeKey, "1");
  }

  void fetchWithCsrf("/api/telemetry/plan-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify({
      event,
      meta,
      path: window.location.pathname,
    }),
  }).catch(() => {
    if (dedupeKey) {
      window.sessionStorage.removeItem(dedupeKey);
    }

    // Telemetry should never block the UI.
  });
}
