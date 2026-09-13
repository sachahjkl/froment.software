import { expect, it } from 'vitest';

import { supplierPaymentPain001 } from './payment-batches.js';

it('generates escaped pain.001.001.03 amounts and payment identifiers', () => {
  const content = new TextDecoder().decode(
    supplierPaymentPain001({
      batchId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      messageId: 'FRO-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      createdAt: '2026-09-12T14:00:00.000Z',
      executionDate: '2026-09-15',
      debtor: {
        name: 'Froment & Associés',
        iban: 'FR7630006000011234567890189',
        bic: 'AGRIFRPP',
      },
      invoices: [
        {
          invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          reference: 'SUP-42 <final>',
          supplierName: 'Supplier & Company',
          amountCents: 12_501,
          functionalAmountCents: 12_501,
          currency: 'EUR',
          status: 'approved',
          documentKind: 'invoice',
          iban: 'FR1420041010050500013M02606',
          bic: '',
        },
      ],
    }),
  );

  expect(content).toContain('urn:iso:std:iso:20022:tech:xsd:pain.001.001.03');
  expect(content).toContain('<CtrlSum>125.01</CtrlSum>');
  expect(content).toContain('<InstdAmt Ccy="EUR">125.01</InstdAmt>');
  expect(content).toContain('<EndToEndId>INV-01ARZ3NDEKTSV4RRFFQ69G5FAW</EndToEndId>');
  expect(content).toContain('<Nm>Supplier &amp; Company</Nm>');
  expect(content).toContain('<Ustrd>SUP-42 &lt;final&gt;</Ustrd>');
  expect(content).toContain('<Othr><Id>NOTPROVIDED</Id></Othr>');
});
