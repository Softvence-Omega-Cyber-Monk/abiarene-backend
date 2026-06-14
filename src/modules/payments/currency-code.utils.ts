const CURRENCY_CODE_ALIASES: Record<string, string> = {
  CFA: 'XAF',
};

export function normalizeCurrencyCode(currency?: string | null) {
  const normalizedCurrency = currency?.trim().toUpperCase() ?? null;
  if (!normalizedCurrency) {
    return null;
  }

  return CURRENCY_CODE_ALIASES[normalizedCurrency] ?? normalizedCurrency;
}

