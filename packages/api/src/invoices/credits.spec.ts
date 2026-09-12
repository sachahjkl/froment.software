import { DateTime, Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { describe, expect, it } from 'vitest';
import { BusinessConfig } from '../business/business-config.js';
import { Database } from '../database/database.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import {
  integrationDatabaseLayer,
  integrationTestTime,
  seedIntegrationInvoice,
} from '../integrations/invoice.spec-helper.js';
import { InvoiceCreditNotes, InvoiceCreditNotesLive } from './credits.js';

const layer = () =>
  InvoiceCreditNotesLive.pipe(
    Layer.provide(
      Layer.succeed(BusinessConfig, {
        timeZone: DateTime.zoneMakeNamedUnsafe('Europe/Paris'),
      }),
    ),
    Layer.provide(
      Layer.succeed(DocumentRenderer, {
        renderQuotePdf: () => Effect.die('unused'),
        renderInvoicePdf: () => Effect.die('unused'),
        renderOrderPdf: () => Effect.die('unused'),
        renderCreditNotePdf: () => Effect.die('unused'),
      }),
    ),
    Layer.provideMerge(integrationDatabaseLayer()),
  );

const requestConflict = {
  _tag: 'Failure',
  failure: { _tag: 'InvoiceCreditRequestConflict', code: 'invoice.credit_request_conflict' },
};
const businessConflict = {
  _tag: 'Failure',
  failure: { _tag: 'InvoiceCreditConflict', code: 'invoice.credit_conflict' },
};

const seedRefundInvoice = Effect.fn('CreditTest.seedRefundInvoice')(function* () {
  yield* TestClock.setTime(integrationTestTime);
  const invoice = yield* seedIntegrationInvoice();
  const { sqlite } = yield* Database;
  const credits = yield* InvoiceCreditNotes;
  sqlite
    .prepare(`insert into invoice_payments
      (id, invoice_id, request_id, expected_version, amount_cents, paid_on, method, reference,
       recorded_at, recorded_by_user_id)
      values (?, ?, ?, 1, 12000, '2026-09-09', 'transfer', 'RECEIPT', ?, ?)`)
    .run(
      ulid(),
      invoice.invoiceId,
      randomUUID(),
      new Date(integrationTestTime).toISOString(),
      invoice.actorId,
    );
  const draft = yield* credits.create(
    {
      requestId: randomUUID(),
      reason: 'Service cancelled',
      lines: [
        {
          invoiceId: invoice.invoiceId,
          invoiceVersion: 1,
          sourceLineId: invoice.snapshot.lines[0]!.id,
          quantityMilli: invoice.snapshot.lines[0]!.quantityMilli,
        },
      ],
    },
    invoice.actorId,
  );
  yield* credits.issue(
    draft.id,
    { requestId: randomUUID(), expectedVersion: draft.version },
    invoice.actorId,
  );
  return invoice;
});

const refundRequest = () => ({
  requestId: randomUUID(),
  amountCents: 4000,
  refundedOn: '2026-09-09',
  reference: 'REFUND-1',
});

describe('credit request conflicts', () => {
  it('distinguishes a stored credit request from a new request and replays it for another author', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(integrationTestTime);
        const first = yield* seedIntegrationInvoice();
        const second = yield* seedIntegrationInvoice();
        const credits = yield* InvoiceCreditNotes;
        const { sqlite } = yield* Database;
        const request = {
          requestId: randomUUID(),
          reason: 'Cancelled',
          lines: [
            {
              invoiceId: first.invoiceId,
              invoiceVersion: 1,
              sourceLineId: first.snapshot.lines[0]!.id,
              quantityMilli: 1000,
            },
          ],
        };
        const draft = yield* credits.create(request, first.actorId);
        expect(yield* credits.create(request, second.actorId)).toEqual(draft);
        expect(
          yield* Effect.result(credits.create({ ...request, reason: 'Changed' }, first.actorId)),
        ).toMatchObject(requestConflict);
        expect(
          yield* Effect.result(
            credits.create(
              {
                ...request,
                lines: [{ ...request.lines[0], invoiceId: second.invoiceId }],
              },
              first.actorId,
            ),
          ),
        ).toMatchObject(requestConflict);
        const issueRequest = { requestId: randomUUID(), expectedVersion: draft.version };
        const state = yield* credits.issue(draft.id, issueRequest, first.actorId);
        expect(yield* credits.issue(draft.id, issueRequest, second.actorId)).toEqual(state);
        const newRequest = { ...issueRequest, requestId: randomUUID() };
        expect(
          yield* Effect.result(credits.issue(draft.id, newRequest, first.actorId)),
        ).toMatchObject(requestConflict);
        expect(
          sqlite
            .prepare('select 1 from invoice_credit_notes where request_id = ?')
            .get(newRequest.requestId),
        ).toBeUndefined();
        expect(state.issuedByUserId).toBe(first.actorId);
        expect(sqlite.prepare('select count(*) from invoice_credit_notes').pluck().get()).toBe(1);
        expect(
          sqlite
            .prepare("select count(*) from audit_events where action = 'invoice.credited'")
            .pluck()
            .get(),
        ).toBe(1);
      }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
    );
  });

  it('returns a business refusal only after finding no credit request', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(integrationTestTime);
        const { invoiceId, actorId, snapshot } = yield* seedIntegrationInvoice();
        const credits = yield* InvoiceCreditNotes;
        const { sqlite } = yield* Database;
        const request = {
          requestId: randomUUID(),
          reason: 'Cancelled',
          lines: [
            {
              invoiceId,
              invoiceVersion: 2,
              sourceLineId: snapshot.lines[0]!.id,
              quantityMilli: 1000,
            },
          ],
        };
        expect(yield* Effect.result(credits.create(request, actorId))).toMatchObject(
          businessConflict,
        );
        expect(sqlite.prepare('select count(*) from invoice_credit_notes').pluck().get()).toBe(0);
        const state = yield* credits.create(
          {
            ...request,
            lines: [
              {
                invoiceId,
                invoiceVersion: 1,
                sourceLineId: snapshot.lines[0]!.id,
                quantityMilli: 1000,
              },
            ],
          },
          actorId,
        );
        expect(state.requestId).toBe(request.requestId);
      }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
    );
  });

  it('preserves a stored refund through payload conflicts and an identical replay by another author', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { invoiceId, actorId } = yield* seedRefundInvoice();
        const second = yield* seedIntegrationInvoice();
        const credits = yield* InvoiceCreditNotes;
        const { sqlite } = yield* Database;
        const request = refundRequest();
        const state = yield* credits.refund(invoiceId, request, actorId);
        for (const [targetId, changed] of [
          [invoiceId, { ...request, amountCents: 5000 }],
          [invoiceId, { ...request, refundedOn: '2026-09-08' }],
          [invoiceId, { ...request, reference: 'Changed' }],
          [second.invoiceId, request],
          [ulid(), request],
        ] as const) {
          expect(yield* Effect.result(credits.refund(targetId, changed, actorId))).toMatchObject(
            requestConflict,
          );
        }
        expect(yield* credits.refund(invoiceId, request, second.actorId)).toEqual(state);
        expect(state.refunds).toMatchObject([
          { requestId: request.requestId, recordedByUserId: actorId },
        ]);
        expect(sqlite.prepare('select count(*) from invoice_refunds').pluck().get()).toBe(1);
        expect(
          sqlite
            .prepare("select count(*) from audit_events where action = 'invoice.refund-recorded'")
            .pluck()
            .get(),
        ).toBe(1);
      }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
    );
  });

  it('leaves no refund request after a refusal for missing credit, balance or date', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { invoiceId, actorId } = yield* seedRefundInvoice();
        const withoutCredit = yield* seedIntegrationInvoice();
        const credits = yield* InvoiceCreditNotes;
        const { sqlite } = yield* Database;
        for (const [targetId, request] of [
          [ulid(), refundRequest()],
          [withoutCredit.invoiceId, refundRequest()],
          [invoiceId, { ...refundRequest(), amountCents: 12001 }],
          [invoiceId, { ...refundRequest(), refundedOn: '2026-09-08' }],
          [invoiceId, { ...refundRequest(), refundedOn: '2026-09-10' }],
        ] as const) {
          expect(yield* Effect.result(credits.refund(targetId, request, actorId))).toMatchObject(
            businessConflict,
          );
          expect(
            sqlite
              .prepare('select 1 from invoice_refunds where request_id = ?')
              .get(request.requestId),
          ).toBeUndefined();
        }
        expect(sqlite.prepare('select count(*) from invoice_refunds').pluck().get()).toBe(0);
      }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
    );
  });

  it('distinguishes an existing cancellation with another reason from an absent refund', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { invoiceId, actorId } = yield* seedRefundInvoice();
        const second = yield* seedIntegrationInvoice();
        const credits = yield* InvoiceCreditNotes;
        const { sqlite } = yield* Database;
        const request = refundRequest();
        const recorded = yield* credits.refund(invoiceId, request, actorId);
        const refund = recorded.refunds[0];
        if (refund === undefined) throw new Error('refund.missing');
        const cancellation = { reason: 'Wrong reference' };
        const cancelled = yield* credits.cancelRefund(invoiceId, refund.id, cancellation, actorId);
        expect(
          yield* Effect.result(
            credits.cancelRefund(invoiceId, refund.id, { reason: 'Changed' }, actorId),
          ),
        ).toMatchObject(requestConflict);
        expect(
          yield* credits.cancelRefund(invoiceId, refund.id, cancellation, second.actorId),
        ).toEqual(cancelled);
        expect(cancelled.refunds).toMatchObject([
          { id: refund.id, cancellationReason: cancellation.reason, cancelledByUserId: actorId },
        ]);
        expect(yield* credits.refund(invoiceId, request, second.actorId)).toEqual(cancelled);
        const missingInvoiceId = ulid();
        for (const [targetId, refundId] of [
          [invoiceId, ulid()],
          [second.invoiceId, refund.id],
          [missingInvoiceId, refund.id],
        ]) {
          expect(
            yield* Effect.result(credits.cancelRefund(targetId, refundId, cancellation, actorId)),
          ).toMatchObject(businessConflict);
        }
        expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
        expect(() =>
          sqlite
            .prepare('update invoice_refunds set invoice_id = ? where id = ?')
            .run(missingInvoiceId, refund.id),
        ).toThrow('database.trigger.refund_immutable');
        expect(() => sqlite.prepare('delete from invoices where id = ?').run(invoiceId)).toThrow(
          'database.trigger.issued_invoices_immutable',
        );
        expect(() =>
          sqlite
            .prepare(`insert into invoice_refunds
              (id, invoice_id, request_id, amount_cents, refunded_on, reference, recorded_at, recorded_by_user_id)
              select ?, ?, ?, amount_cents, refunded_on, reference, recorded_at, recorded_by_user_id
              from invoice_refunds where id = ?`)
            .run(ulid(), missingInvoiceId, randomUUID(), refund.id),
        ).toThrow(/FOREIGN KEY/);
        expect(sqlite.pragma('foreign_key_check')).toEqual([]);
        expect(yield* credits.get(invoiceId)).toEqual(cancelled);
        expect(
          sqlite
            .prepare("select count(*) from audit_events where action = 'invoice.refund-cancelled'")
            .pluck()
            .get(),
        ).toBe(1);
      }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
    );
  });
});
