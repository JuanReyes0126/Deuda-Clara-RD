import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as completeOnboardingPost } from "@/app/api/auth/onboarding/route";
import { POST as onboardingPreviewPost } from "@/app/api/auth/onboarding/preview/route";
import { ServiceError } from "@/server/services/service-error";
import { buildJsonRequest } from "./request-helpers";

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/server/onboarding/onboarding-service", () => ({
  buildOnboardingPreview: vi.fn(),
  completeUserOnboarding: vi.fn(),
}));

describe("api/auth onboarding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calcula preview del onboarding para el usuario autenticado", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { buildOnboardingPreview } = await import("@/server/onboarding/onboarding-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(buildOnboardingPreview).mockReturnValueOnce({
      estimatedDebtFreeDate: "2027-01-01T00:00:00.000Z",
      potentialSavings: 3141,
      recommendedStrategy: "AVALANCHE",
      recommendedStrategyLabel: "Avalancha",
      priorityDebtName: "Tarjeta Gold",
      immediateAction: "Ataca primero Tarjeta Gold.",
      monthsToDebtFree: 12,
      monthsSaved: 4,
    });

    const response = await onboardingPreviewPost(
      buildJsonRequest("http://localhost/api/auth/onboarding/preview", {
        monthlyIncome: 35_000,
        monthlyDebtBudget: 18_000,
        debts: [
          {
            name: "Tarjeta Gold",
            presetType: "CREDIT_CARD",
            currentBalance: 95_000,
            minimumPayment: 6_500,
            interestRate: 54,
          },
        ],
      }),
    );
    const body = (await response.json()) as {
      recommendedStrategy: string;
      priorityDebtName: string;
    };

    expect(response.status).toBe(200);
    expect(body.recommendedStrategy).toBe("AVALANCHE");
    expect(body.priorityDebtName).toBe("Tarjeta Gold");
  });

  it("persiste el onboarding final en una sola llamada al servicio", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { completeUserOnboarding } = await import("@/server/onboarding/onboarding-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(completeUserOnboarding).mockResolvedValueOnce({
      estimatedDebtFreeDate: "2027-01-01T00:00:00.000Z",
      potentialSavings: 3141,
      recommendedStrategy: "AVALANCHE",
      recommendedStrategyLabel: "Avalancha",
      priorityDebtName: "Tarjeta Gold",
      immediateAction: "Ataca primero Tarjeta Gold.",
      monthsToDebtFree: 12,
      monthsSaved: 4,
    } as never);

    const response = await completeOnboardingPost(
      buildJsonRequest("http://localhost/api/auth/onboarding", {
        monthlyIncome: 35_000,
        monthlyDebtBudget: 18_000,
        debts: [
          {
            name: "Tarjeta Gold",
            presetType: "CREDIT_CARD",
            currentBalance: 95_000,
            minimumPayment: 6_500,
            interestRate: 54,
          },
        ],
      }),
    );
    const body = (await response.json()) as {
      ok: boolean;
      preview: { recommendedStrategy: string };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.preview.recommendedStrategy).toBe("AVALANCHE");
    expect(completeUserOnboarding).toHaveBeenCalledOnce();
  });

  it("devuelve errores de servicio de forma controlada en la vista previa", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { buildOnboardingPreview } = await import("@/server/onboarding/onboarding-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(buildOnboardingPreview).mockImplementationOnce(() => {
      throw new ServiceError("ONBOARDING_INVALID", 400, "La vista previa no pudo calcularse.");
    });

    const response = await onboardingPreviewPost(
      buildJsonRequest("http://localhost/api/auth/onboarding/preview", {
        monthlyIncome: 35_000,
        monthlyDebtBudget: 18_000,
        debts: [
          {
            name: "Tarjeta Gold",
            presetType: "CREDIT_CARD",
            currentBalance: 95_000,
            minimumPayment: 6_500,
            interestRate: 54,
          },
        ],
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("La vista previa no pudo calcularse.");
  });

  it("devuelve errores de servicio de forma controlada al completar onboarding", async () => {
    const { getCurrentSession } = await import("@/lib/auth/session");
    const { completeUserOnboarding } = await import("@/server/onboarding/onboarding-service");

    vi.mocked(getCurrentSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(completeUserOnboarding).mockRejectedValueOnce(
      new ServiceError("ONBOARDING_INVALID", 409, "No se pudo guardar este onboarding."),
    );

    const response = await completeOnboardingPost(
      buildJsonRequest("http://localhost/api/auth/onboarding", {
        monthlyIncome: 35_000,
        monthlyDebtBudget: 18_000,
        debts: [
          {
            name: "Tarjeta Gold",
            presetType: "CREDIT_CARD",
            currentBalance: 95_000,
            minimumPayment: 6_500,
            interestRate: 54,
          },
        ],
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toBe("No se pudo guardar este onboarding.");
  });
});
