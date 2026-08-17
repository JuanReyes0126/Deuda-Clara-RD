export const REMINDER_SLOGAN = "Siempre a tiempo";

export const DEFAULT_REMINDER_DAYS = [5, 2, 0] as const;
export const DEFAULT_REMINDER_HOUR = 8;
export const REMINDER_LOOKBACK_HOURS = 26;

export const REMINDER_DAY_OPTIONS = [
  { value: 5, label: "5 días antes" },
  { value: 2, label: "2 días antes" },
  { value: 0, label: "El mismo día" },
] as const;

export const REMINDER_HOUR_OPTIONS = Array.from({ length: 17 }, (_, index) => {
  const value = index + 6;
  const normalizedHour = value > 12 ? value - 12 : value;
  const meridiem = value >= 12 ? "PM" : "AM";

  return {
    value,
    label: `${normalizedHour}:00 ${meridiem}`,
  };
});

export const REMINDER_TRUST_COPY = [
  "Te avisaremos antes de tus fechas importantes.",
  "Antes del corte. Antes del pago. Sin olvidos.",
  "Recibe recordatorios por correo para mantenerte al día.",
] as const;

export function normalizeReminderDays(days: number[] | null | undefined) {
  const fallback = [...DEFAULT_REMINDER_DAYS];

  if (!days?.length) {
    return fallback;
  }

  const uniqueSorted = [...new Set(days)]
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 30)
    .sort((left, right) => right - left);

  return uniqueSorted.length ? uniqueSorted : fallback;
}
