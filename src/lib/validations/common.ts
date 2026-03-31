import { z } from "zod";

import {
  sanitizeMultilineText,
  sanitizeText,
} from "@/lib/security/sanitize";

const moneySchema = z
  .number()
  .finite("Debes introducir un monto válido.")
  .min(0, "El monto no puede ser negativo.")
  .max(999_999_999, "El monto es demasiado alto.");

const percentageSchema = z
  .number()
  .finite("Debes introducir una tasa válida.")
  .min(0, "La tasa no puede ser negativa.")
  .max(999, "La tasa es demasiado alta.");

const positiveIntegerSchema = z
  .number()
  .int("Debes introducir un valor entero válido.")
  .min(1, "Debe ser mayor que cero.");

export function normalizedTextSchema(max = 255) {
  return z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(1, "Este campo es obligatorio.")
        .max(max, "El texto es demasiado largo."),
    );
}

export function optionalNormalizedTextSchema(max = 255) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const sanitized = sanitizeText(value);
    return sanitized.length ? sanitized : undefined;
  }, z.string().max(max, "El texto es demasiado largo.").optional());
}

export function longTextSchema(max = 4000) {
  return z
    .string()
    .transform(sanitizeMultilineText)
    .pipe(
      z
        .string()
        .min(1, "Este campo es obligatorio.")
        .max(max, "El texto es demasiado largo."),
    );
}

export function optionalLongTextSchema(max = 4000) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const sanitized = sanitizeMultilineText(value);
    return sanitized.length ? sanitized : undefined;
  }, z.string().max(max, "El texto es demasiado largo.").optional());
}

export const moneyInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value.replace(/,/g, ""));
  }

  return value;
}, moneySchema);

export const optionalMoneyInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value.replace(/,/g, ""));
  }

  return value;
}, moneySchema.optional());

export const percentageInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value.replace(/,/g, ""));
  }

  return value;
}, percentageSchema);

export const integerDayInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, positiveIntegerSchema.max(31, "Debe estar entre 1 y 31."));

export const optionalIntegerDayInputSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value;
}, positiveIntegerSchema.max(31, "Debe estar entre 1 y 31.").optional());

export const optionalDateInputSchema = z.preprocess((value) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return value;
}, z.date().optional());

export const requiredDateInputSchema = z.preprocess((value) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return value;
}, z.date());
