import {
  AuditEvent,
  CreditNoteSummary,
  CreditNoteList,
  InvoiceHistory,
  InvoiceNotFound,
  InvoiceReceiptList,
  InvoiceRefundList,
  InvoiceWorkspaceLimitExceeded,
} from '@froment/contracts';
import { DateTime, Effect, Schema } from 'effect';
import { Database, DatabaseError } from '../database/database.js';

const CreditNoteSummaryRow = Schema.Struct({
  ...CreditNoteSummary.fields,
  sourceInvoiceIds: Schema.fromJsonString(Schema.Array(Schema.String)),
  sourceInvoiceNumbers: Schema.fromJsonString(Schema.Array(Schema.String)),
});

export const listInvoiceReceipts = Effect.fn('Invoices.listReceipts')(function* () {
  const { sqlite } = yield* Database;
  return yield* Effect.try({
    try: () => {
      const rows = sqlite
        .prepare(`select
      i.id as invoiceId, i.invoice_number as invoiceNumber, r.title,
      i.client_id as clientId, r.client_display_name as clientDisplayName,
      i.order_id as orderId, o.reference as orderReference,
      entry.id, entry.request_id as requestId, entry.expected_version as expectedVersion,
      entry.amount_cents as amountCents, entry.paid_on as paidOn, entry.method, entry.reference,
      entry.recorded_at as recordedAt, entry.recorded_by_user_id as recordedByUserId,
      entry.cancelled_at as cancelledAt, entry.cancelled_by_user_id as cancelledByUserId,
      entry.cancellation_reason as cancellationReason
      from invoice_payments entry join invoices i on i.id = entry.invoice_id
      join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
      join orders o on o.id = i.order_id order by entry.recorded_at desc, entry.id desc limit 10001`)
        .all();
      if (rows.length > 10000)
        throw new InvoiceWorkspaceLimitExceeded({ code: 'invoice.workspace_limit' });
      return Schema.decodeUnknownSync(InvoiceReceiptList)(rows);
    },
    catch: (cause) =>
      cause instanceof InvoiceWorkspaceLimitExceeded
        ? cause
        : new DatabaseError({ operation: 'invoice.receipts.list', cause }),
  });
});

export const listCreditNotes = Effect.fn('Invoices.listCreditNotes')(function* () {
  const { sqlite } = yield* Database;
  return yield* Effect.try({
    try: () => {
      const rows = sqlite
        .prepare(`select
      entry.id, entry.client_id as clientId, u.display_name as clientDisplayName,
      entry.status, entry.version, entry.number, entry.reason, entry.currency,
      entry.created_at as createdAt, entry.issued_at as issuedAt,
      entry.total_cents as totalCents,
      json_group_array(distinct lines.invoice_id) as sourceInvoiceIds,
      json_group_array(distinct lines.invoice_number) as sourceInvoiceNumbers
      from invoice_credit_notes entry
      join clients c on c.id = entry.client_id
      join users u on u.id = c.id
      join invoice_credit_note_lines lines on lines.credit_note_id = entry.id
      join invoice_credit_note_revisions revisions
        on revisions.id = lines.credit_note_revision_id and revisions.version = entry.version
      group by entry.id
      order by coalesce(entry.issued_at, entry.created_at) desc, entry.id desc limit 10001`)
        .all();
      if (rows.length > 10000)
        throw new InvoiceWorkspaceLimitExceeded({ code: 'invoice.workspace_limit' });
      return Schema.decodeUnknownSync(CreditNoteList)(
        Schema.decodeUnknownSync(Schema.Array(CreditNoteSummaryRow))(rows),
      );
    },
    catch: (cause) =>
      cause instanceof InvoiceWorkspaceLimitExceeded
        ? cause
        : new DatabaseError({ operation: 'invoice.credits.list', cause }),
  });
});

export const listInvoiceRefunds = Effect.fn('Invoices.listRefunds')(function* () {
  const { sqlite } = yield* Database;
  return yield* Effect.try({
    try: () => {
      const rows = sqlite
        .prepare(`select
      i.id as invoiceId, i.invoice_number as invoiceNumber, r.title,
      i.client_id as clientId, r.client_display_name as clientDisplayName,
      i.order_id as orderId, o.reference as orderReference,
      entry.id, entry.request_id as requestId, entry.amount_cents as amountCents,
      entry.refunded_on as refundedOn, entry.reference, entry.recorded_at as recordedAt,
      entry.recorded_by_user_id as recordedByUserId, entry.cancelled_at as cancelledAt,
      entry.cancelled_by_user_id as cancelledByUserId, entry.cancellation_reason as cancellationReason
      from invoice_refunds entry join invoices i on i.id = entry.invoice_id
      join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
      join orders o on o.id = i.order_id order by entry.recorded_at desc, entry.id desc limit 10001`)
        .all();
      if (rows.length > 10000)
        throw new InvoiceWorkspaceLimitExceeded({ code: 'invoice.workspace_limit' });
      return Schema.decodeUnknownSync(InvoiceRefundList)(rows);
    },
    catch: (cause) =>
      cause instanceof InvoiceWorkspaceLimitExceeded
        ? cause
        : new DatabaseError({ operation: 'invoice.refunds.list', cause }),
  });
});

export const readInvoiceHistory = Effect.fn('Invoices.history')(function* (invoiceId: string) {
  const { sqlite } = yield* Database;
  return yield* Effect.try({
    try: () => {
      if (sqlite.prepare('select 1 from invoices where id = ?').get(invoiceId) === undefined) {
        throw new InvoiceNotFound({ code: 'invoice.not_found' });
      }
      const rawRows = sqlite
        .prepare(`select id, action, actor_user_id as actorUserId,
        resource_type as resourceType, resource_id as resourceId,
        request_id as requestId, trace_id as traceId, span_id as spanId,
        occurred_at as occurredAt, metadata from audit_events
          where (resource_type = 'invoice' and resource_id = ?)
            or (resource_type = 'credit-note' and resource_id in (
              select distinct lines.credit_note_id from invoice_credit_note_lines lines
              where lines.invoice_id = ?
            ))
            or (resource_type = 'document' and resource_id in (
              select artifact.id from document_artifacts artifact
              join invoice_revisions revision on revision.id = artifact.invoice_revision_id
              where revision.invoice_id = ?
            ))
         order by occurred_at desc, id desc limit 10001`)
        .all(invoiceId, invoiceId, invoiceId);
      if (rawRows.length > 10000)
        throw new InvoiceWorkspaceLimitExceeded({ code: 'invoice.workspace_limit' });
      const rows = Schema.decodeUnknownSync(
        Schema.Array(
          Schema.Struct({
            ...AuditEvent.fields,
            occurredAt: Schema.Int,
            metadata: Schema.fromJsonString(AuditEvent.fields.metadata),
          }),
        ),
      )(rawRows);
      return Schema.decodeUnknownSync(InvoiceHistory)(
        rows.map((row) => ({
          ...row,
          occurredAt: DateTime.formatIso(DateTime.makeUnsafe(row.occurredAt)),
        })),
      );
    },
    catch: (cause) =>
      cause instanceof InvoiceNotFound || cause instanceof InvoiceWorkspaceLimitExceeded
        ? cause
        : new DatabaseError({ operation: 'invoice.history', cause }),
  });
});
