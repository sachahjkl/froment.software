import {
  SepaMaximumNameLength,
  SupplierInvoiceConflict,
  SupplierPaymentBatch,
  SupplierPaymentBatchList,
  SupplierPaymentBatchListLimit,
  SupplierPaymentBatchNotFound,
  SupplierPaymentBatchInvoice,
  type SupplierPaymentBatchCreateRequest,
  type SupplierPaymentBatch as SupplierPaymentBatchValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

const PaymentInvoiceRecord = Schema.Struct({
  invoiceId: SupplierPaymentBatchInvoice.fields.invoiceId,
  reference: Schema.String,
  supplierName: Schema.String,
  amountCents: Schema.Int,
  functionalAmountCents: Schema.Int,
  currency: Schema.String,
  status: Schema.String,
  documentKind: Schema.String,
  iban: Schema.String,
  bic: Schema.String,
});
const BatchRecord = Schema.Struct({
  id: SupplierPaymentBatch.fields.id,
  requestId: Schema.String,
  request: Schema.String,
  messageId: Schema.String,
  executionDate: Schema.String,
  transactionCount: Schema.Int,
  controlSumCents: Schema.Int,
  createdAt: Schema.Int,
});
const ContentRecord = Schema.Struct({ content: Schema.Uint8Array });
const IssuerPaymentRecord = Schema.Struct({
  displayName: Schema.String,
  iban: Schema.String,
  bic: Schema.String,
});

type PaymentInvoiceRecord = typeof PaymentInvoiceRecord.Type;
type BatchRecord = typeof BatchRecord.Type;

export interface SupplierPaymentBatchService {
  readonly list: Effect.Effect<typeof SupplierPaymentBatchList.Type, DatabaseError>;
  readonly create: (
    request: SupplierPaymentBatchCreateRequest,
    actorUserId: UlidValue,
  ) => Effect.Effect<SupplierPaymentBatchValue, SupplierInvoiceConflict | DatabaseError>;
  readonly download: (
    batchId: UlidValue,
  ) => Effect.Effect<Uint8Array, SupplierPaymentBatchNotFound | DatabaseError>;
}

export class SupplierPaymentBatches extends Context.Service<
  SupplierPaymentBatches,
  SupplierPaymentBatchService
>()('@froment/api/SupplierPaymentBatches') {}

const normalizeBankIdentifier = (value: string): string => value.replaceAll(' ', '').toUpperCase();
const xml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
const amount = (cents: number): string => {
  const exact = BigInt(cents);
  return `${exact / 100n}.${String(exact % 100n).padStart(2, '0')}`;
};
const agent = (bic: string): string =>
  bic === ''
    ? '<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>'
    : `<FinInstnId><BIC>${xml(bic)}</BIC></FinInstnId>`;

export const supplierPaymentPain001 = (input: {
  readonly batchId: string;
  readonly messageId: string;
  readonly createdAt: string;
  readonly executionDate: string;
  readonly debtor: { readonly name: string; readonly iban: string; readonly bic: string };
  readonly invoices: ReadonlyArray<PaymentInvoiceRecord>;
}): Uint8Array => {
  const controlSum = input.invoices.reduce((sum, invoice) => sum + invoice.amountCents, 0);
  const transactions = input.invoices
    .map(
      // oxlint-disable-next-line anti-slop/no-natural-language-literals -- ISO 20022 XML markup, not interface prose.
      (invoice) => `<CdtTrfTxInf>
<PmtId><EndToEndId>INV-${invoice.invoiceId}</EndToEndId></PmtId>
<Amt><InstdAmt Ccy="EUR">${amount(invoice.amountCents)}</InstdAmt></Amt>
<CdtrAgt>${agent(invoice.bic)}</CdtrAgt>
<Cdtr><Nm>${xml(invoice.supplierName)}</Nm></Cdtr>
<CdtrAcct><Id><IBAN>${xml(invoice.iban)}</IBAN></Id></CdtrAcct>
<RmtInf><Ustrd>${xml(invoice.reference)}</Ustrd></RmtInf>
</CdtTrfTxInf>`,
    )
    .join('\n');
  // oxlint-disable-next-line anti-slop/no-natural-language-literals -- ISO 20022 XML markup, not interface prose.
  const document = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
<CstmrCdtTrfInitn>
<GrpHdr><MsgId>${xml(input.messageId)}</MsgId><CreDtTm>${xml(input.createdAt)}</CreDtTm><NbOfTxs>${input.invoices.length}</NbOfTxs><CtrlSum>${amount(controlSum)}</CtrlSum><InitgPty><Nm>${xml(input.debtor.name)}</Nm></InitgPty></GrpHdr>
<PmtInf>
<PmtInfId>PMT-${input.batchId}</PmtInfId><PmtMtd>TRF</PmtMtd><BtchBookg>true</BtchBookg><NbOfTxs>${input.invoices.length}</NbOfTxs><CtrlSum>${amount(controlSum)}</CtrlSum>
<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf><ReqdExctnDt>${input.executionDate}</ReqdExctnDt>
<Dbtr><Nm>${xml(input.debtor.name)}</Nm></Dbtr><DbtrAcct><Id><IBAN>${xml(input.debtor.iban)}</IBAN></Id></DbtrAcct><DbtrAgt>${agent(input.debtor.bic)}</DbtrAgt><ChrgBr>SLEV</ChrgBr>
${transactions}
</PmtInf>
</CstmrCdtTrfInitn>
</Document>
`;
  return new TextEncoder().encode(document);
};

const validateParty = (
  party: { readonly displayName: string; readonly iban: string },
  accountCode:
    | 'supplier_payment_batch.debtor_account_incomplete'
    | 'supplier_payment_batch.creditor_account_incomplete',
) => {
  if (party.displayName.length > SepaMaximumNameLength)
    throw new SupplierInvoiceConflict({ code: 'supplier_payment_batch.party_name_too_long' });
  if (normalizeBankIdentifier(party.iban) === '')
    throw new SupplierInvoiceConflict({ code: accountCode });
};

export const SupplierPaymentBatchesLive = Layer.effect(
  SupplierPaymentBatches,
  Effect.gen(function* () {
    const database = yield* Database;
    const audit = yield* Audit;

    const invoicesForBatch = (batchId: string) =>
      Schema.decodeUnknownSync(Schema.Array(SupplierPaymentBatchInvoice))(
        database.sqlite
          .prepare(
            `select i.id as invoiceId, i.reference, s.display_name as supplierName,
                    item.amount_cents as amountCents
             from supplier_payment_batch_items item
             join supplier_invoices i on i.id = item.invoice_id
             join suppliers s on s.id = i.supplier_id
             where item.batch_id = ? order by i.due_date, i.id`,
          )
          .all(batchId),
      );
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- The database row is decoded at this boundary.
    const decodeBatch = (row: unknown): SupplierPaymentBatchValue => {
      const batch = Schema.decodeUnknownSync(BatchRecord)(row);
      return Schema.decodeUnknownSync(SupplierPaymentBatch)({
        id: batch.id,
        messageId: batch.messageId,
        executionDate: batch.executionDate,
        transactionCount: batch.transactionCount,
        controlSumCents: batch.controlSumCents,
        createdAt: batch.createdAt,
        invoices: invoicesForBatch(batch.id),
      });
    };
    const getByRequestId = (requestId: string) =>
      database.sqlite
        .prepare(
          `select id, request_id as requestId, request, message_id as messageId,
                  execution_date as executionDate, transaction_count as transactionCount,
                  control_sum_cents as controlSumCents, created_at as createdAt
           from supplier_payment_batches where request_id = ?`,
        )
        .get(requestId);

    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(SupplierPaymentBatchList)(
          database.sqlite
            .prepare(
              `select id, request_id as requestId, request, message_id as messageId,
                      execution_date as executionDate, transaction_count as transactionCount,
                      control_sum_cents as controlSumCents, created_at as createdAt
               from supplier_payment_batches order by created_at desc, id desc limit ?`,
            )
            .all(SupplierPaymentBatchListLimit)
            .map(decodeBatch),
        ),
      catch: (cause) => new DatabaseError({ operation: 'list.supplier.payment.batches', cause }),
    });

    const create = Effect.fn('SupplierPaymentBatches.create')(function* (
      request: SupplierPaymentBatchCreateRequest,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const normalizedRequest = {
        ...request,
        invoiceIds: [...request.invoiceIds].sort(),
      };
      const serializedRequest = JSON.stringify(normalizedRequest);
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const existing = getByRequestId(request.requestId);
              if (existing !== undefined) {
                const batch = Schema.decodeUnknownSync(BatchRecord)(existing);
                if (batch.request !== serializedRequest)
                  throw new SupplierInvoiceConflict({
                    code: 'supplier_payment_batch.creation_conflict',
                  });
                return decodeBatch(existing);
              }
              if (
                new Set(normalizedRequest.invoiceIds).size !== normalizedRequest.invoiceIds.length
              )
                throw new SupplierInvoiceConflict({
                  code: 'supplier_payment_batch.creation_conflict',
                });
              const placeholders = normalizedRequest.invoiceIds.map(() => '?').join(', ');
              const alreadyScheduled = database.sqlite
                .prepare(
                  `select 1 from supplier_payment_batch_items where invoice_id in (${placeholders}) limit 1`,
                )
                .get(...normalizedRequest.invoiceIds);
              if (alreadyScheduled !== undefined)
                throw new SupplierInvoiceConflict({
                  code: 'supplier_payment_batch.invoice_not_payable',
                });
              const rows = Schema.decodeUnknownSync(Schema.Array(PaymentInvoiceRecord))(
                database.sqlite
                  .prepare(
                    `select i.id as invoiceId, i.reference,
                             i.total_cents - coalesce((select sum(c.total_cents)
                               from supplier_invoices c where c.source_invoice_id = i.id
                               and c.document_kind = 'credit' and c.status in ('approved','paid')), 0)
                               as amountCents,
                             i.functional_total_cents - coalesce((select sum(c.functional_total_cents)
                               from supplier_invoices c where c.source_invoice_id = i.id
                               and c.document_kind = 'credit' and c.status in ('approved','paid')), 0)
                               as functionalAmountCents,
                            i.currency, i.status, i.document_kind as documentKind,
                            s.display_name as supplierName, s.iban, s.bic
                     from supplier_invoices i join suppliers s on s.id = i.supplier_id
                     where i.id in (${placeholders})`,
                  )
                  .all(...normalizedRequest.invoiceIds),
              );
              if (rows.length !== normalizedRequest.invoiceIds.length)
                throw new SupplierInvoiceConflict({
                  code: 'supplier_payment_batch.invoice_not_payable',
                });
              const byId = new Map(rows.map((invoice) => [invoice.invoiceId, invoice]));
              const invoices = normalizedRequest.invoiceIds.map((id) => {
                const invoice = byId.get(id);
                if (
                  invoice === undefined ||
                  invoice.status !== 'approved' ||
                  invoice.documentKind !== 'invoice' ||
                  invoice.amountCents <= 0 ||
                  invoice.functionalAmountCents <= 0
                )
                  throw new SupplierInvoiceConflict({
                    code: 'supplier_payment_batch.invoice_not_payable',
                  });
                if (invoice.currency !== 'EUR')
                  throw new SupplierInvoiceConflict({
                    code: 'supplier_payment_batch.currency_not_supported',
                  });
                validateParty(
                  { displayName: invoice.supplierName, iban: invoice.iban },
                  'supplier_payment_batch.creditor_account_incomplete',
                );
                return {
                  ...invoice,
                  iban: normalizeBankIdentifier(invoice.iban),
                  bic: normalizeBankIdentifier(invoice.bic),
                };
              });
              const debtor = Schema.decodeUnknownSync(IssuerPaymentRecord)(
                database.sqlite
                  .prepare(
                    'select display_name as displayName, iban, bic from issuer_settings where id = 1',
                  )
                  .get(),
              );
              validateParty(debtor, 'supplier_payment_batch.debtor_account_incomplete');
              const id = Schema.decodeUnknownSync(SupplierPaymentBatch.fields.id)(ulid(now));
              const messageId = `FRO-${id}`;
              const controlSumCents = invoices.reduce(
                (sum, invoice) => sum + invoice.amountCents,
                0,
              );
              const content = supplierPaymentPain001({
                batchId: id,
                messageId,
                createdAt: DateTime.formatIso(DateTime.makeUnsafe(now)),
                executionDate: normalizedRequest.executionDate,
                debtor: {
                  name: debtor.displayName,
                  iban: normalizeBankIdentifier(debtor.iban),
                  bic: normalizeBankIdentifier(debtor.bic),
                },
                invoices,
              });
              database.sqlite
                .prepare(
                  `insert into supplier_payment_batches
                   (id, request_id, request, message_id, execution_date, transaction_count,
                     control_sum_cents, content, created_by_user_id, created_at)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                  id,
                  request.requestId,
                  serializedRequest,
                  messageId,
                  normalizedRequest.executionDate,
                  invoices.length,
                  controlSumCents,
                  content,
                  actorUserId,
                  now,
                );
              const insertItem = database.sqlite.prepare(
                `insert into supplier_payment_batch_items
                 (batch_id, invoice_id, amount_cents, functional_amount_cents)
                 values (?, ?, ?, ?)`,
              );
              for (const invoice of invoices)
                insertItem.run(
                  id,
                  invoice.invoiceId,
                  invoice.amountCents,
                  invoice.functionalAmountCents,
                );
              audit.insert({
                action: 'supplier-payment-batch.created',
                actorUserId,
                resourceType: 'supplier-payment-batch',
                resourceId: id,
                occurredAt: now,
                metadata: {
                  transactionCount: String(invoices.length),
                  controlSumCents: String(controlSumCents),
                  executionDate: normalizedRequest.executionDate,
                },
              });
              return decodeBatch(getByRequestId(request.requestId));
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof SupplierInvoiceConflict
            ? cause
            : new DatabaseError({ operation: 'create.supplier.payment.batch', cause }),
      });
    });

    const download = Effect.fn('SupplierPaymentBatches.download')(function* (batchId: UlidValue) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare('select content from supplier_payment_batches where id = ?')
            .get(batchId);
          if (row === undefined)
            throw new SupplierPaymentBatchNotFound({ code: 'supplier_payment_batch.not_found' });
          return Schema.decodeUnknownSync(ContentRecord)(row).content;
        },
        catch: (cause) =>
          cause instanceof SupplierPaymentBatchNotFound
            ? cause
            : new DatabaseError({ operation: 'download.supplier.payment.batch', cause }),
      });
    });

    return SupplierPaymentBatches.of({ list, create, download });
  }),
);
