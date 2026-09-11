import {
  CreditNote,
  CreditNoteRequest,
  InvoiceCreditConflict,
  InvoiceCredits,
  InvoiceRefund,
  InvoiceRefundRequest,
  InvoiceRefundCancel,
  InvoiceRenderSnapshot,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { allocateBusinessReference, businessYear } from '../business/business-references.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import { verifyArtifactContent } from '../documents/artifact-integrity.js';
import { invoiceIssueDate } from './invoices.js';

const creditQuery =
  'select id, invoice_id as invoiceId, invoice_revision_id as invoiceRevisionId, request_id as requestId, number, reason, issued_at as issuedAt, issued_by_user_id as issuedByUserId, net_total_cents as netTotalCents, vat_total_cents as vatTotalCents, total_cents as totalCents from invoice_credit_notes';
const refundQuery =
  'select id, invoice_id as invoiceId, request_id as requestId, amount_cents as amountCents, refunded_on as refundedOn, reference, recorded_at as recordedAt, recorded_by_user_id as recordedByUserId, cancelled_at as cancelledAt, cancelled_by_user_id as cancelledByUserId, cancellation_reason as cancellationReason from invoice_refunds';
const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const business = yield* BusinessConfig;
  const renderer = yield* DocumentRenderer;
  const conflict = () => new InvoiceCreditConflict({ code: 'invoice.credit_conflict' });
  const read = (invoiceId: string) => {
    if (sqlite.prepare('select 1 from invoices where id = ?').get(invoiceId) === undefined)
      throw conflict();
    const noteRow = sqlite.prepare(`${creditQuery} where invoice_id = ?`).get(invoiceId);
    const creditNote = noteRow === undefined ? null : Schema.decodeUnknownSync(CreditNote)(noteRow);
    const refunds = Schema.decodeUnknownSync(Schema.Array(InvoiceRefund))(
      sqlite.prepare(`${refundQuery} where invoice_id = ? order by recorded_at, id`).all(invoiceId),
    );
    const paid = Schema.decodeUnknownSync(Schema.Int)(
      sqlite
        .prepare(
          'select coalesce(sum(amount_cents), 0) from invoice_payments where invoice_id = ? and cancelled_at is null',
        )
        .pluck()
        .get(invoiceId),
    );
    const refunded = refunds.reduce(
      (sum, refund) => sum + (refund.cancelledAt === null ? BigInt(refund.amountCents) : 0n),
      0n,
    );
    return InvoiceCredits.make({
      creditNote,
      refunds,
      refundableCents:
        creditNote === null ? 0 : Number(BigInt(Math.min(paid, creditNote.totalCents)) - refunded),
    });
  };
  const get = Effect.fn('InvoiceCredits.get')((invoiceId: string) =>
    Effect.try({
      try: () => read(invoiceId),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.credits.get', cause }),
    }),
  );
  const issue = Effect.fn('InvoiceCredits.issue')(function* (
    invoiceId: string,
    request: typeof CreditNoteRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const prior = sqlite
              .prepare(`${creditQuery} where request_id = ?`)
              .get(request.requestId);
            if (prior !== undefined) {
              const note = Schema.decodeUnknownSync(CreditNote)(prior);
              const expected = sqlite
                .prepare('select expected_version from invoice_credit_notes where id = ?')
                .pluck()
                .get(note.id);
              if (
                note.invoiceId !== invoiceId ||
                note.reason !== request.reason.trim() ||
                expected !== request.expectedVersion
              )
                throw conflict();
              return read(invoiceId);
            }
            const raw = sqlite
              .prepare(
                'select i.status, i.version, r.render_snapshot as snapshot from invoices i join invoice_revisions r on r.invoice_id = i.id and r.version = i.version where i.id = ?',
              )
              .get(invoiceId);
            if (raw === undefined) throw conflict();
            const invoice = Schema.decodeUnknownSync(
              Schema.Struct({
                status: Schema.String,
                version: Schema.Int,
                snapshot: Schema.fromJsonString(InvoiceRenderSnapshot),
              }),
            )(raw);
            if (
              !['issued', 'paid'].includes(invoice.status) ||
              invoice.version !== request.expectedVersion ||
              invoice.snapshot.totalCents === 0 ||
              read(invoiceId).creditNote !== null
            )
              throw conflict();
            const snapshot = invoice.snapshot;
            const id = ulid();
            const number = allocateBusinessReference(
              sqlite,
              'credit-note',
              businessYear(now, business.timeZone),
            );
            const issuedAt = DateTime.formatIso(DateTime.makeUnsafe(now));
            sqlite
              .prepare(
                'insert into invoice_credit_notes (id, invoice_id, invoice_revision_id, request_id, number, reason, issued_at, issued_by_user_id, net_total_cents, vat_total_cents, total_cents, expected_version) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                id,
                invoiceId,
                snapshot.revisionId,
                request.requestId,
                number,
                request.reason.trim(),
                issuedAt,
                actor,
                snapshot.netTotalCents,
                snapshot.vatTotalCents,
                snapshot.totalCents,
                request.expectedVersion,
              );
            audit.insert({
              action: 'invoice.credited',
              actorUserId: actor,
              resourceType: 'invoice',
              resourceId: invoiceId,
              occurredAt: now,
              metadata: { creditNoteId: id, number, totalCents: String(snapshot.totalCents) },
            });
            return read(invoiceId);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.credits.issue', cause }),
    });
  });
  const refund = Effect.fn('InvoiceCredits.refund')(function* (
    invoiceId: string,
    request: typeof InvoiceRefundRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const existing = sqlite
              .prepare(`${refundQuery} where request_id = ?`)
              .get(request.requestId);
            if (existing !== undefined) {
              const saved = Schema.decodeUnknownSync(InvoiceRefund)(existing);
              if (
                saved.invoiceId !== invoiceId ||
                saved.amountCents !== request.amountCents ||
                saved.refundedOn !== request.refundedOn ||
                saved.reference !== request.reference.trim()
              )
                throw conflict();
              return read(invoiceId);
            }
            const state = read(invoiceId);
            if (
              state.creditNote === null ||
              !Schema.is(InvoiceRefundRequest)(request) ||
              request.amountCents > state.refundableCents ||
              request.refundedOn > invoiceIssueDate(now, business.timeZone) ||
              request.refundedOn <
                invoiceIssueDate(Date.parse(state.creditNote.issuedAt), business.timeZone)
            )
              throw conflict();
            const id = ulid();
            sqlite
              .prepare(
                'insert into invoice_refunds (id, invoice_id, request_id, amount_cents, refunded_on, reference, recorded_at, recorded_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                id,
                invoiceId,
                request.requestId,
                request.amountCents,
                request.refundedOn,
                request.reference.trim(),
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actor,
              );
            audit.insert({
              action: 'invoice.refund-recorded',
              actorUserId: actor,
              resourceType: 'invoice',
              resourceId: invoiceId,
              occurredAt: now,
              metadata: { refundId: id, amountCents: String(request.amountCents) },
            });
            return read(invoiceId);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.refund.record', cause }),
    });
  });
  const cancelRefund = Effect.fn('InvoiceCredits.cancelRefund')(function* (
    invoiceId: string,
    refundId: string,
    request: typeof InvoiceRefundCancel.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const saved = read(invoiceId).refunds.find((refund) => refund.id === refundId);
            if (saved === undefined) throw conflict();
            if (saved.cancelledAt !== null) {
              if (saved.cancellationReason !== request.reason.trim()) throw conflict();
              return read(invoiceId);
            }
            sqlite
              .prepare(
                'update invoice_refunds set cancelled_at = ?, cancelled_by_user_id = ?, cancellation_reason = ? where id = ?',
              )
              .run(
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actor,
                request.reason.trim(),
                refundId,
              );
            audit.insert({
              action: 'invoice.refund-cancelled',
              actorUserId: actor,
              resourceType: 'invoice',
              resourceId: invoiceId,
              occurredAt: now,
              metadata: { refundId, reason: request.reason.trim() },
            });
            return read(invoiceId);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.refund.cancel', cause }),
    });
  });
  const pdf = Effect.fn('InvoiceCredits.pdf')(function* (invoiceId: string) {
    const state = yield* get(invoiceId);
    if (state.creditNote === null) return yield* conflict();
    const note = state.creditNote;
    const readPdf = () => {
      const row = sqlite
        .prepare(
          "select content, sha256 from document_artifacts where invoice_revision_id = ? and kind = 'credit-note-pdf'",
        )
        .get(note.invoiceRevisionId);
      return row === undefined
        ? undefined
        : verifyArtifactContent(
            Schema.decodeUnknownSync(
              Schema.Struct({ content: Schema.Uint8Array, sha256: Schema.String }),
            )(row),
          ).content;
    };
    const saved = yield* Effect.try({
      try: readPdf,
      catch: (cause) => new DatabaseError({ operation: 'credit.pdf.read', cause }),
    });
    if (saved !== undefined) return { content: saved, number: note.number };
    const snapshot = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.fromJsonString(InvoiceRenderSnapshot))(
          sqlite
            .prepare('select render_snapshot from invoice_revisions where id = ?')
            .pluck()
            .get(note.invoiceRevisionId),
        ),
      catch: (cause) => new DatabaseError({ operation: 'credit.snapshot.read', cause }),
    });
    const issuedOn = invoiceIssueDate(Date.parse(note.issuedAt), business.timeZone);
    const content = yield* renderer.renderCreditNotePdf(snapshot, note, issuedOn);
    const now = yield* Clock.currentTimeMillis;
    const result = yield* Effect.try({
      try: () => {
        sqlite
          .prepare(
            "insert or ignore into document_artifacts (id, invoice_revision_id, kind, content_type, content, byte_size, sha256, created_at) values (?, ?, 'credit-note-pdf', 'application/pdf', ?, ?, ?, ?)",
          )
          .run(
            ulid(),
            note.invoiceRevisionId,
            Buffer.from(content),
            content.byteLength,
            createHash('sha256').update(content).digest('hex'),
            now,
          );
        const stored = readPdf();
        if (stored === undefined) throw new Error('credit.pdf.missing');
        return stored;
      },
      catch: (cause) => new DatabaseError({ operation: 'credit.pdf.store', cause }),
    });
    return { content: result, number: note.number };
  });
  const clientPdf = Effect.fn('InvoiceCredits.clientPdf')(function* (
    invoiceId: string,
    clientId: string,
  ) {
    const owns = yield* Effect.try({
      try: () =>
        sqlite
          .prepare('select 1 from invoices where id = ? and client_id = ?')
          .get(invoiceId, clientId) !== undefined,
      catch: (cause) => new DatabaseError({ operation: 'credit.client.check', cause }),
    });
    if (!owns) return yield* conflict();
    return yield* pdf(invoiceId);
  });
  return { get, issue, refund, cancelRefund, pdf, clientPdf };
});
export class InvoiceCreditNotes extends Context.Service<
  InvoiceCreditNotes,
  Effect.Success<typeof make>
>()('@froment/api/InvoiceCreditNotes') {}
export const InvoiceCreditNotesLive = Layer.effect(InvoiceCreditNotes, make);
