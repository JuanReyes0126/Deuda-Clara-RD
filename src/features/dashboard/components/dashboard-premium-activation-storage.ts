"use client";

export const premiumActivationWindowMs = 5 * 60 * 1000;
const premiumActivationStorageKey = "deuda-clara-rd-premium-activation";

export type PremiumActivationState = {
  startedAt: number;
  completed: string[];
};

export function readPremiumActivationState() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(premiumActivationStorageKey);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as PremiumActivationState;

    if (!parsed.startedAt || !Array.isArray(parsed.completed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function persistPremiumActivationState(
  nextState: PremiumActivationState | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (!nextState) {
    window.localStorage.removeItem(premiumActivationStorageKey);
    return;
  }

  window.localStorage.setItem(
    premiumActivationStorageKey,
    JSON.stringify(nextState),
  );
}
