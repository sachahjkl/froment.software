const decimalPattern = /^\d+(?:[.,]\d+)?$/;

export const parseFixedDecimal = (value: string, decimalPlaces: number): number | undefined => {
  const normalized = value.trim();
  if (!decimalPattern.test(normalized)) return undefined;
  const [integerPart, fractionPart = ''] = normalized.replace(',', '.').split('.');
  if (fractionPart.length > decimalPlaces) return undefined;
  const factor = 10 ** decimalPlaces;
  const result = Number(integerPart) * factor + Number(fractionPart.padEnd(decimalPlaces, '0'));
  if (!Number.isSafeInteger(result)) return undefined;
  return result;
};

export const formatFixedDecimal = (
  value: number,
  decimalPlaces: number,
  decimalSeparator: '.' | ',' = '.',
): string => {
  const factor = 10 ** decimalPlaces;
  const integerPart = Math.floor(value / factor);
  const fractionPart = String(value % factor).padStart(decimalPlaces, '0');
  return `${integerPart}${decimalSeparator}${fractionPart}`;
};
