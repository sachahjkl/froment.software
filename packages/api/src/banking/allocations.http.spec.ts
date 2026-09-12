import {
  BankPaymentList,
  BankTransactionList,
  DefaultBankCsvConfiguration,
  InvoiceDetail,
} from '@froment/contracts';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  acceptQuote,
  createQuote,
  setIssuer,
  createClient,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('splits receipts across credits, groups receipts, rejects excess allocations, and releases only the cancelled allocation', async () => {
  const server = await startHttpTestServer();
  const post = (path: string, body: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(body),
    });
  const get = async (path: string) =>
    (await fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders })).json();
  try {
    await setIssuer(server);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);
    let draft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: accepted.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2026-10-01',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    draft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post(`/api/invoices/${draft.id}/revisions`, {
          expectedVersion: draft.version,
          refreshParties: false,
          title: draft.currentRevision.title,
          serviceDate: '2026-09-01',
          dueDate: '2026-10-01',
          paymentTerms: '30 days',
          lines: [
            {
              description: 'Grouped receipt test',
              quantityMilli: 1000,
              unitPriceCents: 100000,
              vatRateBasisPoints: 2000,
            },
          ],
        })
      ).json(),
    );
    expect(
      (await post(`/api/invoices/${draft.id}/issue`, { expectedVersion: draft.version })).status,
    ).toBe(200);
    let invoice = Schema.decodeUnknownSync(InvoiceDetail)(await get(`/api/invoices/${draft.id}`));
    for (const amountCents of [10000, 20000, 5000]) {
      invoice = Schema.decodeUnknownSync(InvoiceDetail)(
        await (
          await post(`/api/invoices/${draft.id}/payments`, {
            requestId: randomUUID(),
            expectedVersion: invoice.version,
            amountCents,
            paidOn: '2026-09-01',
            method: 'transfer',
            reference: String(amountCents),
          })
        ).json(),
      );
    }
    expect(
      (
        await post('/api/banking/import', {
          account: 'GROUP',
          format: 'csv',
          csvConfiguration: DefaultBankCsvConfiguration,
          content:
            'transaction_id,booked_on,amount,currency,description\nA,2026-09-01,150.00,EUR,Grouped\nB,2026-09-01,200.00,EUR,Split',
        })
      ).status,
    ).toBe(200);
    const list = async () =>
      Schema.decodeUnknownSync(BankTransactionList)(await get('/api/banking/transactions'));
    const available = async () =>
      Schema.decodeUnknownSync(BankPaymentList)(
        await get(`/api/banking/invoices/${draft.id}/payments`),
      );
    const a = (await list()).find((row) => row.reference === 'A');
    const b = (await list()).find((row) => row.reference === 'B');
    const first = invoice.payments.find((payment) => payment.amountCents === 10000);
    const second = invoice.payments.find((payment) => payment.amountCents === 20000);
    const third = invoice.payments.find((payment) => payment.amountCents === 5000);
    if (!a || !b || !first || !second || !third) throw new Error('bank.test.fixture_missing');
    const allocation = {
      paymentId: first.id,
      amountCents: 6000,
      feeCents: 0,
      requestId: randomUUID(),
    };
    const match = (transactionId: string, paymentId: string, amountCents: number, feeCents = 0) =>
      post(`/api/banking/transactions/${transactionId}/match`, {
        paymentId,
        amountCents,
        feeCents,
        requestId: randomUUID(),
      });
    expect((await post(`/api/banking/transactions/${a.id}/match`, allocation)).status).toBe(200);
    expect((await post(`/api/banking/transactions/${a.id}/match`, allocation)).status).toBe(200);
    expect(
      (await post(`/api/banking/transactions/${a.id}/match`, { ...allocation, amountCents: 6001 }))
        .status,
    ).toBe(409);
    expect((await match(b.id, first.id, 4001)).status).toBe(409);
    expect((await match(a.id, second.id, 9001)).status).toBe(409);
    expect((await match(a.id, second.id, 0)).status).toBe(400);
    expect((await match(a.id, second.id, 100, 100)).status).toBe(400);
    expect((await match(a.id, second.id, 100, -1)).status).toBe(400);
    expect((await match(a.id, second.id, 9000)).status).toBe(200);
    expect((await match(b.id, first.id, 4000)).status).toBe(200);
    expect((await match(b.id, second.id, 11000)).status).toBe(200);
    expect((await available()).find((payment) => payment.id === first.id)?.availableCents).toBe(0);
    const competing = await Promise.all([
      match(b.id, third.id, 5000, 100),
      match(b.id, third.id, 5000, 100),
    ]);
    expect(competing.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await list()).find((row) => row.id === a.id)).toMatchObject({
      matchedCents: 15000,
      allocations: expect.arrayContaining([
        {
          matchId: expect.any(String),
          paymentId: first.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountCents: 6000,
          feeCents: 0,
          paymentCancelled: false,
        },
      ]),
    });
    expect((await list()).find((row) => row.id === b.id)?.allocations).toHaveLength(3);
    expect((await list()).find((row) => row.id === b.id)?.matchedCents).toBe(19900);
    expect((await available()).find((payment) => payment.id === third.id)?.availableCents).toBe(0);
    const feeAllocation = (await list())
      .find((row) => row.id === b.id)
      ?.allocations.find((item) => item.paymentId === third.id);
    if (feeAllocation === undefined) throw new Error('bank.test.fee_allocation_missing');
    expect(feeAllocation.feeCents).toBe(100);
    expect(
      (
        await post(`/api/banking/transactions/${b.id}/unmatch`, {
          matchId: feeAllocation.matchId,
          reason: 'Correct fee',
        })
      ).status,
    ).toBe(200);
    expect((await list()).find((row) => row.id === b.id)?.matchedCents).toBe(15000);
    expect((await available()).find((payment) => payment.id === third.id)?.availableCents).toBe(
      5000,
    );
    const remove = (await list())
      .find((row) => row.id === a.id)
      ?.allocations.find((item) => item.paymentId === first.id);
    if (remove === undefined) throw new Error('bank.test.allocation_missing');
    expect(
      (
        await post(`/api/banking/transactions/${a.id}/unmatch`, {
          matchId: remove.matchId,
          reason: 'Incorrect partial allocation',
        })
      ).status,
    ).toBe(200);
    expect((await list()).find((row) => row.id === a.id)?.matchedCents).toBe(9000);
    expect((await available()).find((payment) => payment.id === first.id)?.availableCents).toBe(
      6000,
    );
    expect((await post(`/api/banking/transactions/${a.id}/match`, allocation)).status).toBe(200);
    expect((await list()).find((row) => row.id === a.id)?.matchedCents).toBe(9000);
    expect(
      Schema.decodeUnknownSync(InvoiceDetail)(await get(`/api/invoices/${invoice.id}`)),
    ).toMatchObject({ version: invoice.version, payments: invoice.payments });
  } finally {
    await server.close();
  }
}, 25000);
