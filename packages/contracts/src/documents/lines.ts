import { Schema } from 'effect';

import { Ulid } from '../identifiers.js';

export const SafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
export const PositiveSafeInteger = SafeInteger.check(Schema.isGreaterThan(0));

export const DocumentLineInput = Schema.Struct({
  description: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  quantityMilli: PositiveSafeInteger,
  unitPriceCents: SafeInteger,
  vatRateBasisPoints: SafeInteger.check(Schema.isLessThanOrEqualTo(10_000)),
});

const roundHalfUp = (numerator: bigint, denominator: bigint): bigint =>
  (numerator + denominator / 2n) / denominator;

export const DocumentLine = Schema.Struct({
  id: Ulid,
  position: SafeInteger,
  ...DocumentLineInput.fields,
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
}).check(
  Schema.makeFilter((line) => {
    const netTotal = roundHalfUp(BigInt(line.quantityMilli) * BigInt(line.unitPriceCents), 1_000n);
    const vatTotal = roundHalfUp(netTotal * BigInt(line.vatRateBasisPoints), 10_000n);
    const issues: Array<Schema.FilterIssue> = [];
    if (BigInt(line.netTotalCents) !== netTotal) {
      issues.push({ path: ['netTotalCents'], issue: 'an exact calculated net total' });
    }
    if (BigInt(line.vatTotalCents) !== vatTotal) {
      issues.push({ path: ['vatTotalCents'], issue: 'an exact calculated VAT total' });
    }
    if (BigInt(line.totalCents) !== netTotal + vatTotal) {
      issues.push({ path: ['totalCents'], issue: 'an exact calculated total' });
    }
    return issues;
  }),
);

export const DocumentLines = Schema.Array(DocumentLine).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(20),
  Schema.makeFilter((lines) => {
    const issues: Array<Schema.FilterIssue> = [];
    const ids = new Set<string>();
    for (const [position, line] of lines.entries()) {
      if (line.position !== position) {
        issues.push({ path: [position, 'position'], issue: `position ${position}` });
      }
      if (ids.has(line.id)) {
        issues.push({ path: [position, 'id'], issue: 'a unique line identifier' });
      }
      ids.add(line.id);
    }
    return issues;
  }),
);

interface DocumentTotals {
  readonly netTotalCents: number;
  readonly vatTotalCents: number;
  readonly totalCents: number;
  readonly lines: ReadonlyArray<{
    readonly netTotalCents: number;
    readonly vatTotalCents: number;
  }>;
}

export const documentTotalsFilter = Schema.makeFilter<DocumentTotals>((document) => {
  const netTotal = document.lines.reduce((total, line) => total + BigInt(line.netTotalCents), 0n);
  const vatTotal = document.lines.reduce((total, line) => total + BigInt(line.vatTotalCents), 0n);
  const issues: Array<Schema.FilterIssue> = [];
  if (BigInt(document.netTotalCents) !== netTotal) {
    issues.push({ path: ['netTotalCents'], issue: 'the sum of line net totals' });
  }
  if (BigInt(document.vatTotalCents) !== vatTotal) {
    issues.push({ path: ['vatTotalCents'], issue: 'the sum of line VAT totals' });
  }
  if (BigInt(document.totalCents) !== netTotal + vatTotal) {
    issues.push({ path: ['totalCents'], issue: 'the sum of line totals' });
  }
  return issues;
});
