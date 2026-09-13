import {
  SupplierInvoice,
  SupplierInvoiceConflict,
  SupplierInvoiceLine,
  SupplierInvoiceEvidence,
  SupplierInvoiceEvidenceList,
  SupplierInvoiceList,
  SupplierInvoiceMaximumReferenceLength,
  SupplierInvoiceMaximumVatRateBasisPoints,
  SupplierInvoiceNotFound,
  type SupplierInvoiceCreateRequest,
  type SupplierCreditCreateRequest,
  type SupplierInvoiceEvidenceCreate,
  type SupplierInvoiceLineInput,
  type SupplierInvoiceStatus,
  type SupplierInvoiceUpdateRequest,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';
import { createHash } from 'node:crypto';

import { Audit } from '../audit/audit.js';
import {
  convertToFunctionalCents,
  findCurrencyConversion,
} from '../company/currency-conversion.js';
import { Database, DatabaseError } from '../database/database.js';
import { AccountingPostingUnavailable, postAccountingEntry } from '../accounting/posting.js';

const InvoiceRecord = Schema.Struct({
  id: SupplierInvoice.fields.id,
  requestId: Schema.String,
  request: Schema.String,
  supplierId: SupplierInvoice.fields.supplierId,
  supplierName: Schema.String,
  taxTreatment: SupplierInvoice.fields.taxTreatment,
  documentKind: SupplierInvoice.fields.documentKind,
  sourceInvoiceId: SupplierInvoice.fields.sourceInvoiceId,
  reference: Schema.String,
  invoiceDate: Schema.String,
  dueDate: Schema.String,
  currency: Schema.String,
  notes: Schema.String,
  netTotalCents: Schema.Int,
  vatTotalCents: Schema.Int,
  totalCents: Schema.Int,
  functionalCurrency: Schema.NullOr(Schema.String),
  exchangeRateDate: Schema.NullOr(Schema.String),
  foreignUnitsPerFunctionalUnitNanos: Schema.NullOr(Schema.Int),
  functionalNetTotalCents: Schema.NullOr(Schema.Int),
  functionalVatTotalCents: Schema.NullOr(Schema.Int),
  functionalTotalCents: Schema.NullOr(Schema.Int),
  status: SupplierInvoice.fields.status,
  source: SupplierInvoice.fields.source,
  sourceFileName: Schema.NullOr(Schema.String),
  externalSubmissionId: Schema.NullOr(Schema.String),
  confirmedAt: Schema.NullOr(Schema.Int),
  approvedAt: Schema.NullOr(Schema.Int),
  version: Schema.Int,
  createdAt: Schema.Int,
  updatedAt: Schema.Int,
});
const LineRecord = Schema.Struct({ ...SupplierInvoiceLine.fields });

const selectInvoice = `select i.id, i.request_id as requestId, i.request, i.supplier_id as supplierId,
  s.display_name as supplierName, i.document_kind as documentKind,
  i.tax_treatment as taxTreatment,
  i.source_invoice_id as sourceInvoiceId, i.reference, i.invoice_date as invoiceDate, i.due_date as dueDate,
  i.currency, i.notes, i.net_total_cents as netTotalCents, i.vat_total_cents as vatTotalCents,
  i.total_cents as totalCents, i.functional_currency as functionalCurrency,
  i.exchange_rate_date as exchangeRateDate,
  i.foreign_units_per_functional_unit_nanos as foreignUnitsPerFunctionalUnitNanos,
  i.functional_net_total_cents as functionalNetTotalCents,
  i.functional_vat_total_cents as functionalVatTotalCents,
  i.functional_total_cents as functionalTotalCents,
  i.status, i.source, i.source_file_name as sourceFileName,
  i.external_submission_id as externalSubmissionId, i.confirmed_at as confirmedAt,
  i.approved_at as approvedAt, i.version, i.created_at as createdAt, i.updated_at as updatedAt
  from supplier_invoices i join suppliers s on s.id = i.supplier_id`;

const lineValues = (
  lines: ReadonlyArray<SupplierInvoiceLineInput>,
  taxTreatment: SupplierInvoice['taxTreatment'],
) =>
  lines.map((line, position) => {
    const vatTotalCents = Math.round(
      (line.netTotalCents * line.vatRateBasisPoints) / SupplierInvoiceMaximumVatRateBasisPoints,
    );
    return {
      id: ulid(),
      position,
      description: line.description.trim(),
      netTotalCents: line.netTotalCents,
      vatRateBasisPoints: line.vatRateBasisPoints,
      vatTotalCents,
      totalCents:
        taxTreatment === 'eu-reverse-charge' || taxTreatment === 'non-eu-import'
          ? line.netTotalCents
          : line.netTotalCents + vatTotalCents,
    };
  });

const totals = (lines: ReturnType<typeof lineValues>) => ({
  netTotalCents: lines.reduce((sum, line) => sum + line.netTotalCents, 0),
  vatTotalCents: lines.reduce((sum, line) => sum + line.vatTotalCents, 0),
  totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
});
const transitionActions = {
  confirmed: 'supplier-invoice.confirmed',
  approved: 'supplier-invoice.approved',
  cancelled: 'supplier-invoice.cancelled',
} as const;
const supplierPostingLines = (invoice: SupplierInvoice) => {
  const netTotalCents = invoice.functionalNetTotalCents;
  const vatTotalCents = invoice.functionalVatTotalCents;
  const totalCents = invoice.functionalTotalCents;
  if (netTotalCents === null || vatTotalCents === null || totalCents === null) {
    throw new AccountingPostingUnavailable('accounting.functional_value_missing');
  }
  const lines = [];
  const reverseCharge =
    invoice.taxTreatment === 'eu-reverse-charge' || invoice.taxTreatment === 'non-eu-import';
  let taxDueAccount = '4452';
  if (invoice.taxTreatment === 'non-eu-import') taxDueAccount = '44551';
  if (invoice.documentKind === 'credit') {
    lines.push({
      accountCode: '401',
      label: invoice.reference,
      debitCents: totalCents,
      creditCents: 0,
    });
    lines.push({
      accountCode: '607',
      label: invoice.reference,
      debitCents: 0,
      creditCents: netTotalCents,
    });
    if (vatTotalCents > 0 && reverseCharge) {
      lines.push({
        accountCode: '44566',
        label: invoice.reference,
        debitCents: 0,
        creditCents: vatTotalCents,
      });
      lines.push({
        accountCode: taxDueAccount,
        label: invoice.reference,
        debitCents: vatTotalCents,
        creditCents: 0,
      });
    } else if (vatTotalCents > 0)
      lines.push({
        accountCode: '44566',
        label: invoice.reference,
        debitCents: 0,
        creditCents: vatTotalCents,
      });
    return lines;
  }
  lines.push({
    accountCode: '607',
    label: invoice.reference,
    debitCents: netTotalCents,
    creditCents: 0,
  });
  if (vatTotalCents > 0 && reverseCharge) {
    lines.push({
      accountCode: '44566',
      label: invoice.reference,
      debitCents: vatTotalCents,
      creditCents: 0,
    });
    lines.push({
      accountCode: taxDueAccount,
      label: invoice.reference,
      debitCents: 0,
      creditCents: vatTotalCents,
    });
  } else if (vatTotalCents > 0)
    lines.push({
      accountCode: '44566',
      label: invoice.reference,
      debitCents: vatTotalCents,
      creditCents: 0,
    });
  lines.push({
    accountCode: '401',
    label: invoice.reference,
    debitCents: 0,
    creditCents: totalCents,
  });
  return lines;
};

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;

  const read = (id: string) => {
    const row = sqlite.prepare(`${selectInvoice} where i.id = ?`).get(id);
    if (row === undefined) {
      throw new SupplierInvoiceNotFound({ code: 'supplier_invoice.not_found' });
    }
    const record = Schema.decodeUnknownSync(InvoiceRecord)(row);
    const lines = sqlite
      .prepare(
        `select id, position, description, net_total_cents as netTotalCents,
         vat_rate_basis_points as vatRateBasisPoints, vat_total_cents as vatTotalCents,
         total_cents as totalCents from supplier_invoice_lines where invoice_id = ? order by position`,
      )
      .all(id)
      .map((line) => Schema.decodeUnknownSync(LineRecord)(line));
    return Schema.decodeUnknownSync(SupplierInvoice)({ ...record, lines });
  };

  const list = Effect.try({
    try: () =>
      Schema.decodeUnknownSync(SupplierInvoiceList)(
        sqlite
          .prepare(`${selectInvoice} order by i.invoice_date desc, i.created_at desc, i.id desc`)
          .all()
          .map((row) => read(Schema.decodeUnknownSync(InvoiceRecord)(row).id)),
      ),
    catch: (cause) => new DatabaseError({ operation: 'supplier-invoice.list', cause }),
  });

  const get = (id: string) =>
    Effect.try({
      try: () => read(id),
      catch: (cause) =>
        cause instanceof SupplierInvoiceNotFound
          ? cause
          : new DatabaseError({ operation: 'supplier-invoice.get', cause }),
    });
  const evidence = Effect.fn('SupplierInvoices.evidence')(function* (invoiceId: string) {
    yield* get(invoiceId);
    return yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(SupplierInvoiceEvidenceList)(
          sqlite
            .prepare(
              'select id, invoice_id as invoiceId, file_name as fileName, media_type as mediaType, size, sha256, created_at as createdAt from supplier_invoice_evidence where invoice_id = ? order by created_at desc, id desc',
            )
            .all(invoiceId),
        ),
      catch: (cause) => new DatabaseError({ operation: 'supplier-invoice.evidence.list', cause }),
    });
  });
  const createEvidence = Effect.fn('SupplierInvoices.createEvidence')(function* (
    request: SupplierInvoiceEvidenceCreate,
    actorUserId: UlidValue,
  ) {
    yield* get(request.invoiceId);
    const now = yield* Clock.currentTimeMillis;
    const content = Buffer.from(request.contentBase64, 'base64');
    if (content.length === 0)
      return yield* new SupplierInvoiceConflict({ code: 'supplier_invoice.evidence_invalid' });
    const sha256 = createHash('sha256').update(content).digest('hex');
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const existing = sqlite
              .prepare(
                'select id, invoice_id as invoiceId, file_name as fileName, media_type as mediaType, size, sha256, created_at as createdAt from supplier_invoice_evidence where invoice_id = ? and sha256 = ?',
              )
              .get(request.invoiceId, sha256);
            if (existing !== undefined)
              return Schema.decodeUnknownSync(SupplierInvoiceEvidence)(existing);
            const id = ulid(now);
            sqlite
              .prepare(
                'insert into supplier_invoice_evidence (id, invoice_id, file_name, media_type, size, sha256, content, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                id,
                request.invoiceId,
                request.fileName.trim(),
                request.mediaType.trim(),
                content.length,
                sha256,
                content,
                now,
                actorUserId,
              );
            audit.insert({
              action: 'supplier-invoice.evidence-added',
              actorUserId,
              resourceType: 'supplier-invoice-evidence',
              resourceId: id,
              metadata: { invoiceId: request.invoiceId, sha256 },
              occurredAt: now,
            });
            return SupplierInvoiceEvidence.make({
              id,
              invoiceId: request.invoiceId,
              fileName: request.fileName.trim(),
              mediaType: request.mediaType.trim(),
              size: content.length,
              sha256,
              createdAt: now,
            });
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof SupplierInvoiceConflict
          ? cause
          : new DatabaseError({ operation: 'supplier-invoice.evidence.create', cause }),
    });
  });
  const downloadEvidence = Effect.fn('SupplierInvoices.downloadEvidence')(function* (
    evidenceId: string,
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () => {
        const result = Schema.decodeUnknownSync(
          Schema.Struct({
            invoiceId: Schema.String,
            fileName: Schema.String,
            content: Schema.Uint8Array,
          }),
        )(
          sqlite
            .prepare(
              'select invoice_id as invoiceId, file_name as fileName, content from supplier_invoice_evidence where id = ?',
            )
            .get(evidenceId),
        );
        audit.insert({
          action: 'supplier-invoice.evidence-accessed',
          actorUserId,
          resourceType: 'supplier-invoice-evidence',
          resourceId: evidenceId,
          metadata: { invoiceId: result.invoiceId },
          occurredAt: now,
        });
        return result;
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'supplier-invoice.evidence.download', cause }),
    });
  });

  const ensureSupplier = (supplierId: string) => {
    const supplier = sqlite
      .prepare('select tax_treatment as taxTreatment from suppliers where id = ? and archived = 0')
      .get(supplierId);
    if (supplier === undefined) {
      throw new SupplierInvoiceConflict({ code: 'supplier_invoice.supplier_unavailable' });
    }
    return Schema.decodeUnknownSync(
      Schema.Struct({ taxTreatment: SupplierInvoice.fields.taxTreatment }),
    )(supplier).taxTreatment;
  };

  const ensureReference = (supplierId: string, reference: string, excludedId?: string) => {
    const duplicate =
      excludedId === undefined
        ? sqlite
            .prepare('select 1 from supplier_invoices where supplier_id = ? and reference = ?')
            .get(supplierId, reference)
        : sqlite
            .prepare(
              'select 1 from supplier_invoices where supplier_id = ? and reference = ? and id <> ?',
            )
            .get(supplierId, reference, excludedId);
    if (duplicate !== undefined) {
      throw new SupplierInvoiceConflict({ code: 'supplier_invoice.reference_exists' });
    }
  };

  const writeLines = (invoiceId: string, lines: ReturnType<typeof lineValues>) => {
    sqlite.prepare('delete from supplier_invoice_lines where invoice_id = ?').run(invoiceId);
    const insert = sqlite.prepare(
      `insert into supplier_invoice_lines
       (id, invoice_id, position, description, net_total_cents, vat_rate_basis_points,
        vat_total_cents, total_cents) values (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of lines) {
      insert.run(
        line.id,
        invoiceId,
        line.position,
        line.description,
        line.netTotalCents,
        line.vatRateBasisPoints,
        line.vatTotalCents,
        line.totalCents,
      );
    }
  };

  const create = Effect.fn('SupplierInvoices.create')(function* (
    request: SupplierInvoiceCreateRequest,
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const serialized = JSON.stringify(request);
            const prior = sqlite
              .prepare('select id, request from supplier_invoices where request_id = ?')
              .get(request.requestId);
            if (prior !== undefined) {
              const existing = Schema.decodeUnknownSync(
                Schema.Struct({ id: Schema.String, request: Schema.String }),
              )(prior);
              if (existing.request !== serialized) {
                throw new SupplierInvoiceConflict({
                  code: 'supplier_invoice.creation_conflict',
                });
              }
              return read(existing.id);
            }
            const taxTreatment = ensureSupplier(request.supplierId);
            const reference = request.reference.trim();
            ensureReference(request.supplierId, reference);
            const lines = lineValues(request.lines, taxTreatment);
            const invoiceTotals = totals(lines);
            const id = ulid();
            sqlite
              .prepare(
                `insert into supplier_invoices
                  (id, request_id, request, supplier_id, tax_treatment, reference, invoice_date, due_date, currency,
                  notes, net_total_cents, vat_total_cents, total_cents, status, source,
                  source_file_name, external_submission_id, version, created_by_user_id,
                  created_at, updated_at)
                  values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, 1, ?, ?, ?)`,
              )
              .run(
                id,
                request.requestId,
                serialized,
                request.supplierId,
                taxTreatment,
                reference,
                request.invoiceDate,
                request.dueDate,
                request.currency,
                request.notes.trim(),
                invoiceTotals.netTotalCents,
                invoiceTotals.vatTotalCents,
                invoiceTotals.totalCents,
                request.source,
                request.sourceFileName,
                request.externalSubmissionId,
                actorUserId,
                now,
                now,
              );
            writeLines(id, lines);
            audit.insert({
              action: 'supplier-invoice.created',
              actorUserId,
              resourceType: 'supplier-invoice',
              resourceId: id,
              occurredAt: now,
            });
            return read(id);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof SupplierInvoiceConflict
          ? cause
          : new DatabaseError({ operation: 'supplier-invoice.create', cause }),
    });
  });

  const createCredit = Effect.fn('SupplierInvoices.createCredit')(function* (
    request: SupplierCreditCreateRequest,
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const serializedRequest = JSON.stringify(request);
            const prior = sqlite
              .prepare('select id, request from supplier_invoices where request_id = ?')
              .get(request.requestId);
            if (prior !== undefined) {
              const saved = Schema.decodeUnknownSync(
                Schema.Struct({ id: Schema.String, request: Schema.String }),
              )(prior);
              if (saved.request !== serializedRequest)
                throw new SupplierInvoiceConflict({
                  code: 'supplier_invoice.creation_conflict',
                });
              return read(saved.id);
            }
            const source = read(request.sourceInvoiceId);
            if (
              source.documentKind !== 'invoice' ||
              source.status === 'draft' ||
              source.status === 'cancelled'
            ) {
              throw new SupplierInvoiceConflict({ code: 'supplier_invoice.invalid_transition' });
            }
            const id = ulid(now);
            const reference = `CREDIT-${source.reference}-${id.slice(-6)}`.slice(
              0,
              SupplierInvoiceMaximumReferenceLength,
            );
            sqlite
              .prepare(
                `insert into supplier_invoices
                  (id, request_id, request, supplier_id, document_kind, source_invoice_id, tax_treatment,
                  reference, invoice_date, due_date, currency, notes, net_total_cents,
                  vat_total_cents, total_cents, status, source, version, created_by_user_id,
                  created_at, updated_at)
                  values (?, ?, ?, ?, 'credit', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'manual', 1, ?, ?, ?)`,
              )
              .run(
                id,
                request.requestId,
                serializedRequest,
                source.supplierId,
                source.id,
                source.taxTreatment,
                reference,
                source.invoiceDate,
                source.invoiceDate,
                source.currency,
                source.notes,
                source.netTotalCents,
                source.vatTotalCents,
                source.totalCents,
                actorUserId,
                now,
                now,
              );
            writeLines(
              id,
              lineValues(
                source.lines.map((line) => ({
                  description: line.description,
                  netTotalCents: line.netTotalCents,
                  vatRateBasisPoints: line.vatRateBasisPoints,
                })),
                source.taxTreatment,
              ),
            );
            audit.insert({
              action: 'supplier-credit.created',
              actorUserId,
              resourceType: 'supplier-invoice',
              resourceId: id,
              metadata: { sourceInvoiceId: source.id },
              occurredAt: now,
            });
            return read(id);
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof SupplierInvoiceNotFound || cause instanceof SupplierInvoiceConflict)
          return cause;
        return new DatabaseError({ operation: 'supplier-credit.create', cause });
      },
    });
  });

  const update = Effect.fn('SupplierInvoices.update')(function* (
    id: string,
    request: SupplierInvoiceUpdateRequest,
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const current = read(id);
            if (current.version !== request.expectedVersion) {
              throw new SupplierInvoiceConflict({ code: 'supplier_invoice.version_conflict' });
            }
            if (current.status !== 'draft') {
              throw new SupplierInvoiceConflict({ code: 'supplier_invoice.not_editable' });
            }
            if (current.documentKind === 'credit') {
              const source = read(current.sourceInvoiceId ?? '');
              if (
                request.supplierId !== source.supplierId ||
                request.currency !== source.currency ||
                source.taxTreatment !== current.taxTreatment
              ) {
                throw new SupplierInvoiceConflict({ code: 'supplier_invoice.invalid_transition' });
              }
            }
            const taxTreatment = ensureSupplier(request.supplierId);
            const reference = request.reference.trim();
            ensureReference(request.supplierId, reference, id);
            const lines = lineValues(request.lines, taxTreatment);
            const invoiceTotals = totals(lines);
            const updatedAt = Math.max(now, current.updatedAt + 1);
            sqlite
              .prepare(
                `update supplier_invoices set supplier_id = ?, tax_treatment = ?, reference = ?, invoice_date = ?,
                 due_date = ?, currency = ?, notes = ?, net_total_cents = ?, vat_total_cents = ?,
                 total_cents = ?, version = version + 1, updated_at = ?
                 where id = ? and version = ?`,
              )
              .run(
                request.supplierId,
                taxTreatment,
                reference,
                request.invoiceDate,
                request.dueDate,
                request.currency,
                request.notes.trim(),
                invoiceTotals.netTotalCents,
                invoiceTotals.vatTotalCents,
                invoiceTotals.totalCents,
                updatedAt,
                id,
                request.expectedVersion,
              );
            writeLines(id, lines);
            audit.insert({
              action: 'supplier-invoice.updated',
              actorUserId,
              resourceType: 'supplier-invoice',
              resourceId: id,
              occurredAt: updatedAt,
            });
            return read(id);
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof SupplierInvoiceNotFound || cause instanceof SupplierInvoiceConflict)
          return cause;
        return new DatabaseError({ operation: 'supplier-invoice.update', cause });
      },
    });
  });

  const transition = Effect.fn('SupplierInvoices.transition')(function* (
    id: string,
    expectedVersion: number,
    from: ReadonlyArray<SupplierInvoiceStatus>,
    status: 'confirmed' | 'approved' | 'cancelled',
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const current = read(id);
            if (current.version !== expectedVersion) {
              throw new SupplierInvoiceConflict({ code: 'supplier_invoice.version_conflict' });
            }
            if (!from.includes(current.status)) {
              throw new SupplierInvoiceConflict({ code: 'supplier_invoice.invalid_transition' });
            }
            if (status === 'confirmed' && current.documentKind === 'credit') {
              const sourceTotal = Schema.decodeUnknownSync(Schema.Int)(
                sqlite
                  .prepare(
                    "select total_cents from supplier_invoices where id = ? and document_kind = 'invoice'",
                  )
                  .pluck()
                  .get(current.sourceInvoiceId),
              );
              const priorCreditTotal = Schema.decodeUnknownSync(Schema.Int)(
                sqlite
                  .prepare(
                    "select coalesce(sum(total_cents), 0) from supplier_invoices where source_invoice_id = ? and id <> ? and status in ('confirmed','approved','paid')",
                  )
                  .pluck()
                  .get(current.sourceInvoiceId, current.id),
              );
              if (priorCreditTotal + current.totalCents > sourceTotal) {
                throw new SupplierInvoiceConflict({ code: 'supplier_invoice.invalid_transition' });
              }
            }
            const conversion =
              status === 'confirmed'
                ? findCurrencyConversion(sqlite, current.currency, current.invoiceDate)
                : undefined;
            if (status === 'confirmed' && conversion === undefined) {
              throw new SupplierInvoiceConflict({
                code: 'supplier_invoice.exchange_rate_missing',
              });
            }
            const functionalNetTotalCents =
              conversion === undefined
                ? current.functionalNetTotalCents
                : convertToFunctionalCents(
                    current.netTotalCents,
                    conversion.foreignUnitsPerFunctionalUnitNanos,
                  );
            const functionalVatTotalCents =
              conversion === undefined
                ? current.functionalVatTotalCents
                : convertToFunctionalCents(
                    current.vatTotalCents,
                    conversion.foreignUnitsPerFunctionalUnitNanos,
                  );
            const reverseCharge =
              current.taxTreatment === 'eu-reverse-charge' ||
              current.taxTreatment === 'non-eu-import';
            let functionalTotalCents = current.functionalTotalCents;
            if (functionalNetTotalCents !== null && functionalVatTotalCents !== null) {
              functionalTotalCents = functionalNetTotalCents;
              if (!reverseCharge) functionalTotalCents += functionalVatTotalCents;
            }
            const updatedAt = Math.max(now, current.updatedAt + 1);
            sqlite
              .prepare(
                `update supplier_invoices set status = ?, confirmed_at = ?, approved_at = ?,
                  functional_currency = ?, exchange_rate_date = ?,
                  foreign_units_per_functional_unit_nanos = ?, functional_net_total_cents = ?,
                  functional_vat_total_cents = ?, functional_total_cents = ?,
                  version = version + 1, updated_at = ? where id = ? and version = ?`,
              )
              .run(
                status,
                status === 'confirmed' ? updatedAt : current.confirmedAt,
                status === 'approved' ? updatedAt : current.approvedAt,
                conversion?.functionalCurrency ?? current.functionalCurrency,
                conversion?.exchangeRateDate ?? current.exchangeRateDate,
                conversion?.foreignUnitsPerFunctionalUnitNanos ??
                  current.foreignUnitsPerFunctionalUnitNanos,
                functionalNetTotalCents,
                functionalVatTotalCents,
                functionalTotalCents,
                updatedAt,
                id,
                expectedVersion,
              );
            if (status === 'approved') {
              const approved = read(id);
              let description = 'supplier-invoice';
              if (approved.documentKind === 'credit') description = 'supplier-credit';
              postAccountingEntry({
                sqlite,
                sourceType:
                  approved.documentKind === 'credit' ? 'supplier-credit' : 'supplier-invoice',
                sourceId: approved.id,
                journalKind: 'purchases',
                entryDate: approved.invoiceDate,
                reference: approved.reference,
                description,
                currency: approved.functionalCurrency ?? approved.currency,
                actorUserId,
                now: updatedAt,
                lines: supplierPostingLines(approved),
              });
            }
            audit.insert({
              action: transitionActions[status],
              actorUserId,
              resourceType: 'supplier-invoice',
              resourceId: id,
              occurredAt: updatedAt,
            });
            return read(id);
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof SupplierInvoiceNotFound || cause instanceof SupplierInvoiceConflict)
          return cause;
        if (cause instanceof AccountingPostingUnavailable)
          return new SupplierInvoiceConflict({ code: 'supplier_invoice.accounting_unavailable' });
        return new DatabaseError({ operation: 'supplier-invoice.transition', cause });
      },
    });
  });

  return {
    list,
    get,
    evidence,
    createEvidence,
    downloadEvidence,
    create,
    createCredit,
    update,
    transition,
  };
});

export class SupplierInvoices extends Context.Service<
  SupplierInvoices,
  Effect.Success<typeof make>
>()('@froment/api/SupplierInvoices') {}
export const SupplierInvoicesLive = Layer.effect(SupplierInvoices, make);
