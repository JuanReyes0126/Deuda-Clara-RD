export function formatMonthsLabel(months: number | null) {
  if (months === null) {
    return "Sin salida clara";
  }

  if (months === 0) {
    return "Sin deuda activa";
  }

  return `${months} ${months === 1 ? "mes" : "meses"}`;
}
