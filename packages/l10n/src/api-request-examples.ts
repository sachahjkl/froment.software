export const apiRequestExamples = {
  invoiceCreate: {
    orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    serviceDate: '2026-09-01',
    dueDate: '2026-10-01',
    paymentTerms: '30 days',
  },
  invoicePaymentCreate: {
    requestId: '8e26a042-4f52-4a6b-8e15-520ccb10a426',
    expectedVersion: 1,
    amountCents: 12500,
    paidOn: '2026-09-01',
    method: 'transfer',
    reference: 'BANK-001',
  },
  invoicePaymentCancel: { expectedVersion: 1, reason: 'Duplicate entry' },
  bankImport: {
    account: 'MAIN',
    csv: 'transaction_id,booked_on,amount,currency,description\nBANK-001,2026-09-01,125.00,EUR,Payment',
  },
  bankMatch: {
    paymentId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    amountCents: 10000,
    requestId: '91ff5717-c394-4708-bef2-6b5f5cafbdaa',
  },
  bankUnmatch: { matchId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', reason: 'Incorrect association' },
  integrationOperationCreate: {
    kind: 'email',
    expectedMode: 'simulation',
    requestId: '8e26a042-4f52-4a6b-8e15-520ccb10a426',
    reference: 'FA-2026-000001',
    recipient: 'client@example.test',
    subject: 'Payment reminder',
    body: 'The remaining invoice balance is EUR 125.00.',
  },
};
