import { expect, it } from 'vitest';
import { ledgerCsv } from './ledger-export.js';

it('exports maximum safe amounts exactly and neutralizes formulas without losing the original text', () => {
  const csv = ledgerCsv([
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      sourceKind: 'debit',
      sourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      debitAccount: '627',
      creditAccount: '512',
      label: '\t=SUM(1,2)',
      amountCents: Number.MAX_SAFE_INTEGER,
      bookedOn: '2026-09-01',
      recordedAt: '2026-09-06T00:00:00.000Z',
      recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      reversesId: null,
      reversalId: null,
    },
  ]);
  expect(csv).toContain('"90071992547409.91","0.00"');
  expect(csv).toContain('"0.00","90071992547409.91"');
  expect(csv).toContain('"\'\t=SUM(1,2)"');
});
