export const ONBOARDING_MAX_DEBTS = 3;

export const ONBOARDING_DEBT_PRESETS = {
  CREDIT_CARD: {
    label: "Tarjeta",
    creditorName: "Tarjeta registrada en onboarding",
    annualRate: 54,
  },
  PERSONAL_LOAN: {
    label: "Préstamo personal",
    creditorName: "Préstamo registrado en onboarding",
    annualRate: 27,
  },
} as const;

export type OnboardingDebtPresetType = keyof typeof ONBOARDING_DEBT_PRESETS;

export const ONBOARDING_TRUST_COPY = [
  "No conectamos tus cuentas bancarias.",
  "Tú controlas lo que registras.",
] as const;
