export const formatMoney = (minorUnits: number, locale: string, currency: string): string => {
  if (!Number.isSafeInteger(minorUnits)) throw new RangeError('money.invalid_minor_units');
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  if (digits === undefined) throw new RangeError('money.currency_precision_missing');
  const magnitude = BigInt(Math.abs(minorUnits));
  const divisor = 10n ** BigInt(digits);
  const sign = minorUnits < 0 ? '-' : '';
  const integer = `${sign}${magnitude / divisor}`;
  const decimal =
    digits === 0 ? integer : `${integer}.${String(magnitude % divisor).padStart(digits, '0')}`;
  // SAFETY: Integer arithmetic produces a signed decimal string with exactly the currency's fraction digits.
  return formatter.format(decimal as Intl.StringNumericLiteral);
};
