import type { QuoteLineInputValue } from '@froment/contracts';

export interface QuoteLineTotals {
  readonly netTotalCents: number;
  readonly vatTotalCents: number;
  readonly totalCents: number;
}

const roundHalfUp = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;

const safeNumber = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('document.amount.out_of_range');
  }
  return Number(value);
};

export const calculateDocumentLine = (line: QuoteLineInputValue): QuoteLineTotals => {
  const netTotal = roundHalfUp(BigInt(line.quantityMilli) * BigInt(line.unitPriceCents), 1_000n);
  const vatTotal = roundHalfUp(netTotal * BigInt(line.vatRateBasisPoints), 10_000n);
  return {
    netTotalCents: safeNumber(netTotal),
    vatTotalCents: safeNumber(vatTotal),
    totalCents: safeNumber(netTotal + vatTotal),
  };
};

export const calculateDocumentTotals = (lines: ReadonlyArray<QuoteLineTotals>): QuoteLineTotals => {
  const netTotal = lines.reduce((total, line) => total + BigInt(line.netTotalCents), 0n);
  const vatTotal = lines.reduce((total, line) => total + BigInt(line.vatTotalCents), 0n);
  return {
    netTotalCents: safeNumber(netTotal),
    vatTotalCents: safeNumber(vatTotal),
    totalCents: safeNumber(netTotal + vatTotal),
  };
};
