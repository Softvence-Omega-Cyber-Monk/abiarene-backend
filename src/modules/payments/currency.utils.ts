const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const STRIPE_SPECIAL_MINOR_UNIT_MULTIPLIERS = new Map<string, number>([
  ['ISK', 100],
  ['UGX', 100],
]);

export function getCurrencyFractionDigits(currency?: string | null) {
  const normalizedCurrency = currency?.trim().toUpperCase();
  if (!normalizedCurrency) {
    return 2;
  }

  if (
    ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ||
    STRIPE_SPECIAL_MINOR_UNIT_MULTIPLIERS.has(normalizedCurrency)
  ) {
    return 0;
  }

  return 2;
}

export function roundAmountForCurrency(amount: number, currency?: string | null) {
  const fractionDigits = getCurrencyFractionDigits(currency);
  if (fractionDigits === 0) {
    return Math.round(amount);
  }

  return Math.round(amount * 100) / 100;
}

export function toMinorUnits(
  amount: number,
  currency?: string | null,
  provider?: 'stripe' | 'paystack',
) {
  const normalizedCurrency = currency?.trim().toUpperCase() ?? null;

  if (
    provider === 'stripe' &&
    normalizedCurrency &&
    STRIPE_SPECIAL_MINOR_UNIT_MULTIPLIERS.has(normalizedCurrency)
  ) {
    return Math.round(amount * STRIPE_SPECIAL_MINOR_UNIT_MULTIPLIERS.get(normalizedCurrency)!);
  }

  const fractionDigits = getCurrencyFractionDigits(normalizedCurrency);
  if (fractionDigits === 0) {
    return Math.round(amount);
  }

  return Math.round(amount * 100);
}
