"use client";

import { useEffect, useState, type RefObject } from "react";

import {
  persistPremiumActivationState,
  premiumActivationWindowMs,
  readPremiumActivationState,
} from "./dashboard-premium-activation-storage";
import type { PremiumActivationActionTarget } from "./dashboard-premium-activation-steps";

type UsePremiumActivationInput = {
  isPremiumUnlocked: boolean;
  premiumWelcome: boolean;
  initialShowOptimization: boolean;
  upgradePlanHref: string;
  navigateTo: (path: string) => void;
  optimizationRef: RefObject<HTMLElement | null>;
};

export function usePremiumActivation(input: UsePremiumActivationInput) {
  const [showOptimization, setShowOptimization] = useState(
    input.initialShowOptimization,
  );
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(
    input.premiumWelcome,
  );
  const [activationCompletedSteps, setActivationCompletedSteps] = useState<
    string[]
  >([]);
  const [activationRemainingMs, setActivationRemainingMs] = useState(0);

  useEffect(() => {
    if (!input.initialShowOptimization || !input.isPremiumUnlocked) {
      return;
    }

    window.requestAnimationFrame(() => {
      input.optimizationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [input.initialShowOptimization, input.isPremiumUnlocked, input.optimizationRef]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!input.isPremiumUnlocked) {
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        return;
      }

      const now = Date.now();
      let nextState = readPremiumActivationState();

      if (input.premiumWelcome) {
        nextState = {
          startedAt: now,
          completed: [],
        };
        persistPremiumActivationState(nextState);
      }

      if (!nextState) {
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        return;
      }

      const elapsed = now - nextState.startedAt;

      if (elapsed >= premiumActivationWindowMs) {
        persistPremiumActivationState(null);
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        return;
      }

      setShowPremiumWelcome(true);
      setActivationCompletedSteps(nextState.completed);
      setActivationRemainingMs(premiumActivationWindowMs - elapsed);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [input.isPremiumUnlocked, input.premiumWelcome]);

  useEffect(() => {
    if (!showPremiumWelcome || typeof window === "undefined") {
      return;
    }

    const interval = window.setInterval(() => {
      const currentState = readPremiumActivationState();

      if (!currentState) {
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        window.clearInterval(interval);
        return;
      }

      const remaining =
        premiumActivationWindowMs - (Date.now() - currentState.startedAt);

      if (remaining <= 0) {
        persistPremiumActivationState(null);
        setShowPremiumWelcome(false);
        setActivationCompletedSteps([]);
        setActivationRemainingMs(0);
        window.clearInterval(interval);
        return;
      }

      setActivationRemainingMs(remaining);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [showPremiumWelcome]);

  const revealOptimization = () => {
    if (!input.isPremiumUnlocked) {
      input.navigateTo(input.upgradePlanHref);
      return;
    }

    setShowOptimization(true);
    window.requestAnimationFrame(() => {
      input.optimizationRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const completeActivationStep = (stepId: string) => {
    setActivationCompletedSteps((current) => {
      if (current.includes(stepId)) {
        return current;
      }

      const nextCompleted = [...current, stepId];
      const currentState = readPremiumActivationState();

      if (currentState) {
        persistPremiumActivationState({
          ...currentState,
          completed: nextCompleted,
        });
      }

      return nextCompleted;
    });
  };

  const dismissPremiumWelcome = () => {
    persistPremiumActivationState(null);
    setActivationCompletedSteps([]);
    setActivationRemainingMs(0);
    setShowPremiumWelcome(false);
  };

  const runActivationStepAction = (actionTarget: PremiumActivationActionTarget) => {
    if (actionTarget === "optimization") {
      revealOptimization();
      return;
    }

    if (actionTarget === "debts") {
      input.navigateTo("/deudas");
      return;
    }

    if (actionTarget === "payments") {
      input.navigateTo("/pagos");
      return;
    }

    input.navigateTo("/notificaciones");
  };

  return {
    showOptimization,
    showPremiumWelcome,
    activationCompletedSteps,
    activationRemainingMs,
    revealOptimization,
    completeActivationStep,
    dismissPremiumWelcome,
    runActivationStepAction,
  };
}
