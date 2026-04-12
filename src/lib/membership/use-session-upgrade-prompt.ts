"use client";

import { useEffect, useMemo } from "react";

const sessionStorageKey = "dc-upgrade-prompt-session";

type SessionPromptState = {
  total: number;
  exposures: Record<string, number>;
};

function readSessionPromptState(): SessionPromptState {
  if (typeof window === "undefined") {
    return { total: 0, exposures: {} };
  }

  const raw = window.sessionStorage.getItem(sessionStorageKey);

  if (!raw) {
    return { total: 0, exposures: {} };
  }

  try {
    const parsed = JSON.parse(raw) as SessionPromptState;

    return {
      total: typeof parsed.total === "number" ? parsed.total : 0,
      exposures:
        parsed.exposures && typeof parsed.exposures === "object"
          ? parsed.exposures
          : {},
    };
  } catch {
    return { total: 0, exposures: {} };
  }
}

function persistSessionPromptState(state: SessionPromptState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(state));
}

export function useSessionUpgradePrompt({
  id,
  active,
  perSessionLimit = 1,
  globalLimit = 3,
}: {
  id: string;
  active: boolean;
  perSessionLimit?: number;
  globalLimit?: number;
}) {
  const shouldShow = useMemo(() => {
    if (!active) {
      return false;
    }

    const state = readSessionPromptState();
    const promptCount = state.exposures[id] ?? 0;

    if (promptCount >= perSessionLimit || state.total >= globalLimit) {
      return false;
    }
    return true;
  }, [active, globalLimit, id, perSessionLimit]);

  useEffect(() => {
    if (!shouldShow) {
      return;
    }

    const state = readSessionPromptState();
    const promptCount = state.exposures[id] ?? 0;

    if (promptCount >= perSessionLimit || state.total >= globalLimit) {
      return;
    }

    const nextState: SessionPromptState = {
      total: state.total + 1,
      exposures: {
        ...state.exposures,
        [id]: promptCount + 1,
      },
    };

    persistSessionPromptState(nextState);
  }, [globalLimit, id, perSessionLimit, shouldShow]);

  return shouldShow;
}
