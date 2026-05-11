import { afterEach, describe, expect, it, vi } from "vitest";

import { logSecurityEvent } from "@/server/observability/logger";

describe("security logger alerts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite alerta cuando se supera umbral de cron secret rechazado", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      logSecurityEvent("cron_secret_rejected", {
        route: "/api/jobs/notifications",
        ipAddress: "127.0.0.1",
      });
    }

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        message: "security:alert_triggered:cron_secret_rejected",
      }),
    );
  });
});
