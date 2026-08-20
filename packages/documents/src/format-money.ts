export const formatMoney = (cents: number, locale: string, currency: string): string => {
  const amount = BigInt(cents);
  const fraction = (amount % 100n).toString().padStart(2, '0');
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(amount / 100n)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
};
