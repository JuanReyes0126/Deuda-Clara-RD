const currencyFormatters = new Map<string, Intl.NumberFormat>();

export function formatCurrency(
  value: number | string,
  currency: "DOP" | "USD" = "DOP",
  locale = "es-DO",
) {
  const formatterKey = `${locale}:${currency}`;

  if (!currencyFormatters.has(formatterKey)) {
    currencyFormatters.set(
      formatterKey,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }),
    );
  }

  return currencyFormatters.get(formatterKey)!.format(Number(value) || 0);
}
