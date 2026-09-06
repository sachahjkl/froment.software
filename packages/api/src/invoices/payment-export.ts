import {
  CalendarDate,
  InvoicePayment,
  PaymentExportInvalidRange,
  PaymentExportTooLarge,
  type PaymentExportQueryValue,
} from '@froment/contracts';
import { Effect, Schema } from 'effect';
import { Database, DatabaseError } from '../database/database.js';

const ExportRow = Schema.Struct({
  ...InvoicePayment.fields,
  invoiceNumber: Schema.String,
  clientName: Schema.String,
  currency: Schema.Literal('EUR'),
});
export type PaymentExportRow = typeof ExportRow.Type;

const csvCell = (value: string): string => {
  // Control prefixes can hide spreadsheet formulas.
  // eslint-disable-next-line no-control-regex
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const paymentExportCsv = (rows: ReadonlyArray<PaymentExportRow>): string => {
  const header =
    'payment_id,invoice_number,client_name,amount,currency,paid_on,method,reference,recorded_at,recorded_by_user_id';
  const lines = rows.map((row) => {
    const cents = BigInt(row.amountCents);
    const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
    return [
      row.id,
      row.invoiceNumber,
      row.clientName,
      amount,
      row.currency,
      row.paidOn,
      row.method,
      row.reference,
      row.recordedAt,
      row.recordedByUserId,
    ]
      .map(csvCell)
      .join(',');
  });
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
};

export const exportInvoicePayments = Effect.fn('exportInvoicePayments')(function* (
  query: PaymentExportQueryValue,
) {
  if (
    !Schema.is(CalendarDate)(query.from) ||
    !Schema.is(CalendarDate)(query.to) ||
    query.from > query.to
  ) {
    return yield* new PaymentExportInvalidRange({ code: 'payment.export_invalid_range' });
  }
  const database = yield* Database;
  const rows = yield* Effect.try({
    try: () =>
      Schema.decodeUnknownSync(Schema.Array(ExportRow))(
        database.sqlite
          .prepare(`select p.id, p.request_id as requestId, p.expected_version as expectedVersion,
        p.amount_cents as amountCents, p.paid_on as paidOn, p.method, p.reference,
        p.recorded_at as recordedAt, p.recorded_by_user_id as recordedByUserId,
        i.invoice_number as invoiceNumber, r.client_display_name as clientName, r.currency
        from invoice_payments p join invoices i on i.id = p.invoice_id
        join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
        where p.paid_on >= ? and p.paid_on <= ? order by p.paid_on, p.id limit 10001`)
          .all(query.from, query.to),
      ),
    catch: (cause) => new DatabaseError({ operation: 'export.invoice.payments', cause }),
  });
  if (rows.length > 10000)
    return yield* new PaymentExportTooLarge({ code: 'payment.export_too_large' });
  return new TextEncoder().encode(paymentExportCsv(rows));
});
