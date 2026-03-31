import Decimal from "decimal.js";

export type DecimalLike = Decimal.Value | null | undefined;

export function decimal(value: DecimalLike) {
  return new Decimal(value ?? 0);
}

export function toMoneyNumber(value: DecimalLike) {
  return decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function clampMoney(value: DecimalLike, min = 0) {
  return Decimal.max(decimal(value), min);
}
