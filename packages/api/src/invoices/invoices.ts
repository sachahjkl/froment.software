import {
  CalendarDate,
  InvoiceAlreadyExists,
  InvoiceAmountTooLarge,
  InvoiceDetail,
  InvoiceInvalidDates,
  InvoiceInvalidTransition,
  InvoiceIssueResult,
  InvoiceNotEditable,
  InvoiceNotFound,
  InvoiceOrderNotFound,
  InvoiceRenderSnapshot,
  InvoicePdfState,
  InvoiceStatus,
  InvoiceVersionConflict,
  QuoteRenderSnapshot,
  Ulid,
  type InvoiceCreateRequestValue,
  type InvoiceDetailValue,
  type InvoiceIssueRequestValue,
  type InvoiceIssueResultValue,
  type InvoiceListValue,
  type InvoiceRenderSnapshotValue,
  type InvoiceRevisionCreateRequestValue,
  type InvoiceRevisionValue,
  type InvoiceTransitionRequestValue,
  type IssuerSettingsValue,
  type QuoteLineInputValue,
  type QuoteLineValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Option, Schema } from 'effect';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { allocateBusinessReference, businessYear } from '../business/business-references.js';
import { Database, DatabaseError } from '../database/database.js';
import { calculateDocumentLine, calculateDocumentTotals } from '../documents/calculation.js';
import { IssuerSettings } from '../issuer-settings/service.js';

const InvoiceRecord = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  orderReference: Schema.String,
  quoteReference: Schema.String,
  clientId: Ulid,
  status: InvoiceStatus,
  version: Schema.Int,
  invoiceNumber: Schema.NullOr(Schema.String),
  issuedAt: Schema.NullOr(Schema.Int),
  paidAt: Schema.NullOr(Schema.Int),
  voidedAt: Schema.NullOr(Schema.Int),
});
const RevisionRecord = Schema.Struct({
  id: Ulid,
  invoiceId: Ulid,
  version: Schema.Int,
  invoiceNumber: Schema.NullOr(Schema.String),
  issuedAt: Schema.NullOr(Schema.Int),
  clientDisplayName: Schema.NonEmptyString,
  title: Schema.String,
  serviceDate: Schema.String,
  dueDate: Schema.String,
  paymentTerms: Schema.String,
  currency: Schema.Literal('EUR'),
  netTotalCents: Schema.Int,
  vatTotalCents: Schema.Int,
  totalCents: Schema.Int,
  createdAt: Schema.Int,
  createdByUserId: Ulid,
  renderSnapshot: Schema.String,
});
const LineRecord = Schema.Struct({
  id: Ulid,
  revisionId: Ulid,
  position: Schema.Int,
  description: Schema.String,
  quantityMilli: Schema.Int,
  unitPriceCents: Schema.Int,
  vatRateBasisPoints: Schema.Int,
  netTotalCents: Schema.Int,
  vatTotalCents: Schema.Int,
  totalCents: Schema.Int,
});
const OrderRecord = Schema.Struct({
  orderId: Ulid,
  orderReference: Schema.String,
  quoteReference: Schema.String,
  clientId: Ulid,
  quoteSnapshot: Schema.String,
});
const SnapshotRecord = Schema.Struct({ renderSnapshot: Schema.String });
const InvoiceSummaryRecord = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  orderReference: Schema.String,
  clientId: Ulid,
  clientDisplayName: Schema.NonEmptyString,
  status: InvoiceStatus,
  version: Schema.Int,
  invoiceNumber: Schema.NullOr(Schema.String),
  title: Schema.String,
  dueDate: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  updatedAt: Schema.Int,
  pdfStatus: Schema.NullOr(Schema.Literals(['pending', 'processing', 'ready', 'failed'])),
  pdfAttempts: Schema.NullOr(Schema.Int),
  pdfError: Schema.NullOr(Schema.Literal('pdf.render_failed')),
});

type InvoiceError =
  | InvoiceNotFound
  | InvoiceNotEditable
  | InvoiceVersionConflict
  | InvoiceInvalidDates
  | InvoiceAmountTooLarge
  | DatabaseError;

export interface InvoicesService {
  readonly list: Effect.Effect<InvoiceListValue, DatabaseError>;
  readonly get: (
    invoiceId: UlidValue,
  ) => Effect.Effect<InvoiceDetailValue, InvoiceNotFound | DatabaseError>;
  readonly getSnapshot: (
    invoiceId: UlidValue,
    version: number,
  ) => Effect.Effect<InvoiceRenderSnapshotValue, InvoiceNotFound | DatabaseError>;
  readonly create: (
    request: InvoiceCreateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    InvoiceDetailValue,
    | InvoiceOrderNotFound
    | InvoiceAlreadyExists
    | InvoiceInvalidDates
    | InvoiceAmountTooLarge
    | DatabaseError
  >;
  readonly createRevision: (
    invoiceId: UlidValue,
    request: InvoiceRevisionCreateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<InvoiceDetailValue, InvoiceError>;
  readonly issue: (
    invoiceId: UlidValue,
    request: InvoiceIssueRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    InvoiceIssueResultValue,
    | InvoiceNotFound
    | InvoiceVersionConflict
    | InvoiceInvalidDates
    | InvoiceInvalidTransition
    | DatabaseError
  >;
  readonly markPaid: (
    invoiceId: UlidValue,
    request: InvoiceTransitionRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    InvoiceDetailValue,
    InvoiceNotFound | InvoiceVersionConflict | InvoiceInvalidTransition | DatabaseError
  >;
  readonly voidInvoice: (
    invoiceId: UlidValue,
    request: InvoiceTransitionRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    InvoiceDetailValue,
    InvoiceNotFound | InvoiceVersionConflict | InvoiceInvalidTransition | DatabaseError
  >;
}

export class Invoices extends Context.Service<Invoices, InvoicesService>()(
  '@froment/api/Invoices',
) {}

export const invoiceIssueDate = (issuedAt: number, timeZone: DateTime.TimeZone.Named) =>
  DateTime.makeUnsafe(issuedAt).pipe(DateTime.setZone(timeZone), DateTime.formatIsoDate);

const invoiceSql = `select id, order_id as orderId,
  (select reference from orders where orders.id = invoices.order_id) as orderReference,
  (select quotes.reference from orders join quotes on quotes.id = orders.quote_id where orders.id = invoices.order_id) as quoteReference,
  client_id as clientId, status, version,
  invoice_number as invoiceNumber, issued_at as issuedAt, paid_at as paidAt,
  voided_at as voidedAt from invoices`;
const revisionSql = `select id, invoice_id as invoiceId, version,
  invoice_number as invoiceNumber, issued_at as issuedAt,
  client_display_name as clientDisplayName, title, service_date as serviceDate,
  due_date as dueDate, payment_terms as paymentTerms, currency,
  net_total_cents as netTotalCents, vat_total_cents as vatTotalCents,
  total_cents as totalCents, created_at as createdAt, created_by_user_id as createdByUserId,
  render_snapshot as renderSnapshot from invoice_revisions`;
const lineSql = `select id, revision_id as revisionId, position, description,
  quantity_milli as quantityMilli, unit_price_cents as unitPriceCents,
  vat_rate_basis_points as vatRateBasisPoints, net_total_cents as netTotalCents,
  vat_total_cents as vatTotalCents, total_cents as totalCents from invoice_lines`;

export const InvoicesLive = Layer.effect(
  Invoices,
  Effect.gen(function* () {
    const database = yield* Database;
    const issuerSettings = yield* IssuerSettings;
    const audit = yield* Audit;
    const businessConfig = yield* BusinessConfig;

    const readDetail = (invoiceId: string): InvoiceDetailValue | undefined => {
      const rawInvoice = database.sqlite.prepare(`${invoiceSql} where id = ?`).get(invoiceId);
      if (rawInvoice === undefined) return undefined;
      const invoice = Schema.decodeUnknownSync(InvoiceRecord)(rawInvoice);
      const revisions = Schema.decodeUnknownSync(Schema.Array(RevisionRecord))(
        database.sqlite
          .prepare(`${revisionSql} where invoice_id = ? order by version`)
          .all(invoiceId),
      );
      const revisionIds = revisions.map((revision) => revision.id);
      const lines = Schema.decodeUnknownSync(Schema.Array(LineRecord))(
        revisionIds.length === 0
          ? []
          : database.sqlite
              .prepare(
                `${lineSql} where revision_id in (${revisionIds.map(() => '?').join(', ')}) order by revision_id, position`,
              )
              .all(...revisionIds),
      );
      const mappedRevisions = revisions.map((revision): InvoiceRevisionValue => ({
        id: revision.id,
        version: revision.version,
        clientDisplayName: revision.clientDisplayName,
        invoiceNumber: revision.invoiceNumber,
        issuedAt:
          revision.issuedAt === null
            ? null
            : DateTime.formatIso(DateTime.makeUnsafe(revision.issuedAt)),
        title: revision.title,
        serviceDate: revision.serviceDate,
        dueDate: revision.dueDate,
        paymentTerms: revision.paymentTerms,
        currency: revision.currency,
        netTotalCents: revision.netTotalCents,
        vatTotalCents: revision.vatTotalCents,
        totalCents: revision.totalCents,
        createdAt: DateTime.formatIso(DateTime.makeUnsafe(revision.createdAt)),
        createdByUserId: revision.createdByUserId,
        lines: lines
          .filter((line) => line.revisionId === revision.id)
          .map((line): QuoteLineValue => ({
            id: line.id,
            position: line.position,
            description: line.description,
            quantityMilli: line.quantityMilli,
            unitPriceCents: line.unitPriceCents,
            vatRateBasisPoints: line.vatRateBasisPoints,
            netTotalCents: line.netTotalCents,
            vatTotalCents: line.vatTotalCents,
            totalCents: line.totalCents,
          })),
      }));
      const currentRevision = mappedRevisions.find(
        (revision) => revision.version === invoice.version,
      );
      if (currentRevision === undefined) throw new Error('invoice.current_revision.missing');
      const rawPdf = database.sqlite
        .prepare(
          `select status, attempts, error from invoice_pdf_jobs
           where invoice_revision_id = ?`,
        )
        .get(currentRevision.id);
      const pdf = rawPdf === undefined ? null : Schema.decodeUnknownSync(InvoicePdfState)(rawPdf);
      return InvoiceDetail.make({
        ...invoice,
        issuedAt:
          invoice.issuedAt === null
            ? null
            : DateTime.formatIso(DateTime.makeUnsafe(invoice.issuedAt)),
        paidAt:
          invoice.paidAt === null ? null : DateTime.formatIso(DateTime.makeUnsafe(invoice.paidAt)),
        voidedAt:
          invoice.voidedAt === null
            ? null
            : DateTime.formatIso(DateTime.makeUnsafe(invoice.voidedAt)),
        currentRevision,
        revisions: mappedRevisions,
        pdf,
      });
    };

    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(InvoiceSummaryRecord))(
          database.sqlite
            .prepare(
              `select invoices.id, invoices.order_id as orderId, orders.reference as orderReference,
                       invoices.client_id as clientId,
                      invoice_revisions.client_display_name as clientDisplayName,
                      invoices.status, invoices.version, invoices.invoice_number as invoiceNumber,
                       invoice_revisions.title, invoice_revisions.due_date as dueDate,
                       invoice_revisions.currency,
                       invoice_revisions.total_cents as totalCents, invoices.updated_at as updatedAt
                       , invoice_pdf_jobs.status as pdfStatus
                       , invoice_pdf_jobs.attempts as pdfAttempts
                       , invoice_pdf_jobs.error as pdfError
                from invoices join orders on orders.id = invoices.order_id
                join invoice_revisions
                 on invoice_revisions.invoice_id = invoices.id
                 and invoice_revisions.version = invoices.version
               left join invoice_pdf_jobs
                 on invoice_pdf_jobs.invoice_revision_id = invoice_revisions.id
               order by invoices.updated_at desc, invoices.id`,
            )
            .all(),
        ).map((invoice) => ({
          id: invoice.id,
          orderId: invoice.orderId,
          orderReference: invoice.orderReference,
          clientId: invoice.clientId,
          clientDisplayName: invoice.clientDisplayName,
          status: invoice.status,
          version: invoice.version,
          invoiceNumber: invoice.invoiceNumber,
          title: invoice.title,
          dueDate: invoice.dueDate,
          currency: invoice.currency,
          totalCents: invoice.totalCents,
          updatedAt: DateTime.formatIso(DateTime.makeUnsafe(invoice.updatedAt)),
          pdf:
            invoice.pdfStatus === null || invoice.pdfAttempts === null
              ? null
              : InvoicePdfState.make({
                  status: invoice.pdfStatus,
                  attempts: invoice.pdfAttempts,
                  error: invoice.pdfError,
                }),
        })),
      catch: (cause) => new DatabaseError({ operation: 'list.invoices', cause }),
    });

    const get = Effect.fn('Invoices.get')(function* (invoiceId: UlidValue) {
      return yield* Effect.try({
        try: () => {
          const detail = readDetail(invoiceId);
          if (detail === undefined) throw new InvoiceNotFound({ code: 'invoice.not_found' });
          return detail;
        },
        catch: (cause) =>
          cause instanceof InvoiceNotFound
            ? cause
            : new DatabaseError({ operation: 'get.invoice', cause }),
      });
    });

    const getSnapshot = Effect.fn('Invoices.getSnapshot')(function* (
      invoiceId: UlidValue,
      version: number,
    ) {
      return yield* Effect.try({
        try: () => {
          const raw = database.sqlite
            .prepare(
              `select render_snapshot as renderSnapshot from invoice_revisions
               where invoice_id = ? and version = ?`,
            )
            .get(invoiceId, version);
          if (raw === undefined) throw new InvoiceNotFound({ code: 'invoice.not_found' });
          const record = Schema.decodeUnknownSync(SnapshotRecord)(raw);
          return Schema.decodeUnknownSync(InvoiceRenderSnapshot)(JSON.parse(record.renderSnapshot));
        },
        catch: (cause) =>
          cause instanceof InvoiceNotFound
            ? cause
            : new DatabaseError({ operation: 'get.invoice.snapshot', cause }),
      });
    });

    const validateDates = (serviceDate: string, dueDate: string, minimumDueDate?: string) => {
      if (
        Option.isNone(Schema.decodeUnknownOption(CalendarDate)(serviceDate)) ||
        Option.isNone(Schema.decodeUnknownOption(CalendarDate)(dueDate)) ||
        dueDate < serviceDate ||
        (minimumDueDate !== undefined && dueDate < minimumDueDate)
      ) {
        throw new InvoiceInvalidDates({ code: 'invoice.invalid_dates' });
      }
    };

    const insertRevision = (input: {
      readonly invoiceId: string;
      readonly orderId: string;
      readonly orderReference: string;
      readonly quoteReference: string;
      readonly version: number;
      readonly invoiceNumber: string | null;
      readonly issuedAt: number | null;
      readonly issuer: IssuerSettingsValue;
      readonly client: (typeof InvoiceRenderSnapshot.Type)['client'];
      readonly title: string;
      readonly serviceDate: string;
      readonly dueDate: string;
      readonly paymentTerms: string;
      readonly lines: ReadonlyArray<QuoteLineInputValue>;
      readonly actorUserId: string;
      readonly now: number;
    }) => {
      const revisionId = ulid(input.now);
      const calculatedLines = input.lines.map((line, position) => ({
        ...line,
        id: ulid(input.now),
        position,
        description: line.description.trim(),
        ...calculateDocumentLine(line),
      }));
      const totals = calculateDocumentTotals(calculatedLines);
      const snapshot = Schema.decodeUnknownSync(InvoiceRenderSnapshot)({
        templateId: 'invoice-default',
        templateVersion: 1,
        invoiceId: input.invoiceId,
        orderId: input.orderId,
        orderReference: input.orderReference,
        quoteReference: input.quoteReference,
        revisionId,
        version: input.version,
        createdAt: DateTime.formatIso(DateTime.makeUnsafe(input.now)),
        invoiceNumber: input.invoiceNumber,
        issuedAt:
          input.issuedAt === null ? null : DateTime.formatIso(DateTime.makeUnsafe(input.issuedAt)),
        serviceDate: input.serviceDate,
        dueDate: input.dueDate,
        issuer: input.issuer,
        client: input.client,
        title: input.title.trim(),
        paymentTerms: input.paymentTerms,
        currency: 'EUR',
        ...totals,
        lines: calculatedLines,
      });
      database.sqlite
        .prepare(
          `insert into invoice_revisions
           (id, invoice_id, version, invoice_number, issued_at, client_display_name, title,
            service_date, due_date, payment_terms, currency, net_total_cents, vat_total_cents,
            total_cents, created_at, created_by_user_id, template_id, template_version,
              render_snapshot)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, 'invoice-default', 1, ?)`,
        )
        .run(
          revisionId,
          input.invoiceId,
          input.version,
          input.invoiceNumber,
          input.issuedAt,
          input.client.displayName,
          input.title.trim(),
          input.serviceDate,
          input.dueDate,
          input.paymentTerms,
          totals.netTotalCents,
          totals.vatTotalCents,
          totals.totalCents,
          input.now,
          input.actorUserId,
          JSON.stringify(snapshot),
        );
      const insertLine = database.sqlite.prepare(
        `insert into invoice_lines
         (id, revision_id, position, description, quantity_milli, unit_price_cents,
          vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const line of calculatedLines) {
        insertLine.run(
          line.id,
          revisionId,
          line.position,
          line.description,
          line.quantityMilli,
          line.unitPriceCents,
          line.vatRateBasisPoints,
          line.netTotalCents,
          line.vatTotalCents,
          line.totalCents,
        );
      }
      return snapshot;
    };

    const create = Effect.fn('Invoices.create')(function* (
      request: InvoiceCreateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const issuer = yield* issuerSettings.get;
      const invoiceId = ulid(now);
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              validateDates(request.serviceDate, request.dueDate);
              const existingInvoiceId = database.sqlite
                .prepare('select id from invoices where order_id = ?')
                .pluck()
                .get(request.orderId);
              if (existingInvoiceId !== undefined) {
                throw new InvoiceAlreadyExists({
                  code: 'invoice.already_exists',
                  invoiceId: Schema.decodeUnknownSync(Ulid)(existingInvoiceId),
                });
              }
              const rawOrder = database.sqlite
                .prepare(
                  `select orders.id as orderId, orders.reference as orderReference,
                           quotes.reference as quoteReference, orders.client_id as clientId,
                           quote_revisions.render_snapshot as quoteSnapshot
                    from orders join quotes on quotes.id = orders.quote_id
                    join quote_revisions on quote_revisions.id = orders.revision_id
                   where orders.id = ? and orders.status = 'confirmed'`,
                )
                .get(request.orderId);
              if (rawOrder === undefined) {
                throw new InvoiceOrderNotFound({ code: 'invoice.order_not_found' });
              }
              const order = Schema.decodeUnknownSync(OrderRecord)(rawOrder);
              const quoteSnapshot = Schema.decodeUnknownSync(QuoteRenderSnapshot)(
                JSON.parse(order.quoteSnapshot),
              );
              database.sqlite
                .prepare(
                  `insert into invoices
                   (id, order_id, client_id, status, version, created_at, updated_at)
                   values (?, ?, ?, 'draft', 1, ?, ?)`,
                )
                .run(invoiceId, order.orderId, order.clientId, now, now);
              insertRevision({
                invoiceId,
                orderId: order.orderId,
                orderReference: order.orderReference,
                quoteReference: order.quoteReference,
                version: 1,
                invoiceNumber: null,
                issuedAt: null,
                issuer,
                client: quoteSnapshot.client,
                title: quoteSnapshot.title,
                serviceDate: request.serviceDate,
                dueDate: request.dueDate,
                paymentTerms: request.paymentTerms,
                lines: quoteSnapshot.lines,
                actorUserId,
                now,
              });
              audit.insert({
                action: 'invoice.created',
                actorUserId,
                resourceType: 'invoice',
                resourceId: invoiceId,
                metadata: {
                  orderId: order.orderId,
                  orderReference: order.orderReference,
                  quoteReference: order.quoteReference,
                  version: '1',
                },
                occurredAt: now,
              });
              const detail = readDetail(invoiceId);
              if (detail === undefined) throw new Error('invoice.created.missing');
              return detail;
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof InvoiceOrderNotFound ||
            cause instanceof InvoiceAlreadyExists ||
            cause instanceof InvoiceInvalidDates
          ) {
            return cause;
          }
          if (cause instanceof RangeError) {
            return new InvoiceAmountTooLarge({ code: 'invoice.amount_too_large' });
          }
          return new DatabaseError({ operation: 'create.invoice', cause });
        },
      });
    });

    const createRevision = Effect.fn('Invoices.createRevision')(function* (
      invoiceId: UlidValue,
      request: InvoiceRevisionCreateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const issuer = yield* issuerSettings.get;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              validateDates(request.serviceDate, request.dueDate);
              const rawInvoice = database.sqlite
                .prepare(`${invoiceSql} where id = ?`)
                .get(invoiceId);
              if (rawInvoice === undefined) {
                throw new InvoiceNotFound({ code: 'invoice.not_found' });
              }
              const invoice = Schema.decodeUnknownSync(InvoiceRecord)(rawInvoice);
              if (invoice.status !== 'draft') {
                throw new InvoiceNotEditable({ code: 'invoice.not_editable' });
              }
              if (invoice.version !== request.expectedVersion) {
                throw new InvoiceVersionConflict({
                  code: 'invoice.version_conflict',
                  currentVersion: invoice.version,
                });
              }
              const currentRaw = database.sqlite
                .prepare(
                  `select render_snapshot as renderSnapshot from invoice_revisions
                   where invoice_id = ? and version = ?`,
                )
                .get(invoiceId, invoice.version);
              if (currentRaw === undefined) throw new Error('invoice.current_snapshot.missing');
              const currentRecord = Schema.decodeUnknownSync(SnapshotRecord)(currentRaw);
              const current = Schema.decodeUnknownSync(InvoiceRenderSnapshot)(
                JSON.parse(currentRecord.renderSnapshot),
              );
              const nextVersion = invoice.version + 1;
              const updated = database.sqlite
                .prepare(
                  `update invoices set version = ?, updated_at = ?
                   where id = ? and status = 'draft' and version = ?`,
                )
                .run(nextVersion, now, invoiceId, request.expectedVersion).changes;
              if (updated !== 1) {
                throw new InvoiceVersionConflict({
                  code: 'invoice.version_conflict',
                  currentVersion: invoice.version,
                });
              }
              insertRevision({
                invoiceId,
                orderId: invoice.orderId,
                orderReference: current.orderReference,
                quoteReference: current.quoteReference,
                version: nextVersion,
                invoiceNumber: null,
                issuedAt: null,
                issuer,
                client: current.client,
                title: request.title,
                serviceDate: request.serviceDate,
                dueDate: request.dueDate,
                paymentTerms: request.paymentTerms,
                lines: request.lines,
                actorUserId,
                now,
              });
              audit.insert({
                action: 'invoice.revised',
                actorUserId,
                resourceType: 'invoice',
                resourceId: invoiceId,
                metadata: { version: String(nextVersion) },
                occurredAt: now,
              });
              const detail = readDetail(invoiceId);
              if (detail === undefined) throw new Error('invoice.revised.missing');
              return detail;
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof InvoiceNotFound ||
            cause instanceof InvoiceNotEditable ||
            cause instanceof InvoiceVersionConflict ||
            cause instanceof InvoiceInvalidDates
          ) {
            return cause;
          }
          if (cause instanceof RangeError) {
            return new InvoiceAmountTooLarge({ code: 'invoice.amount_too_large' });
          }
          return new DatabaseError({ operation: 'create.invoice.revision', cause });
        },
      });
    });

    const issue = Effect.fn('Invoices.issue')(function* (
      invoiceId: UlidValue,
      request: InvoiceIssueRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const rawInvoice = database.sqlite
                .prepare(`${invoiceSql} where id = ?`)
                .get(invoiceId);
              if (rawInvoice === undefined) {
                throw new InvoiceNotFound({ code: 'invoice.not_found' });
              }
              const invoice = Schema.decodeUnknownSync(InvoiceRecord)(rawInvoice);
              if (invoice.status !== 'draft') {
                if (invoice.status !== 'issued') {
                  throw new InvoiceInvalidTransition({
                    code: 'invoice.invalid_transition',
                    currentStatus: invoice.status,
                  });
                }
                if (invoice.invoiceNumber === null || invoice.issuedAt === null) {
                  throw new Error('invoice.issued_metadata.missing');
                }
                if (
                  request.expectedVersion !== invoice.version - 1 &&
                  request.expectedVersion !== invoice.version
                ) {
                  throw new InvoiceVersionConflict({
                    code: 'invoice.version_conflict',
                    currentVersion: invoice.version,
                  });
                }
                const finalRevision = database.sqlite
                  .prepare(
                    `select id from invoice_revisions
                     where invoice_id = ? and version = ?`,
                  )
                  .pluck()
                  .get(invoiceId, invoice.version);
                return InvoiceIssueResult.make({
                  invoiceId,
                  revisionId: Schema.decodeUnknownSync(Ulid)(finalRevision),
                  version: invoice.version,
                  status: 'issued',
                  invoiceNumber: invoice.invoiceNumber,
                  issuedAt: DateTime.formatIso(DateTime.makeUnsafe(invoice.issuedAt)),
                });
              }
              if (invoice.version !== request.expectedVersion) {
                throw new InvoiceVersionConflict({
                  code: 'invoice.version_conflict',
                  currentVersion: invoice.version,
                });
              }
              const currentRaw = database.sqlite
                .prepare(
                  `select render_snapshot as renderSnapshot from invoice_revisions
                   where invoice_id = ? and version = ?`,
                )
                .get(invoiceId, invoice.version);
              if (currentRaw === undefined) throw new Error('invoice.current_snapshot.missing');
              const currentRecord = Schema.decodeUnknownSync(SnapshotRecord)(currentRaw);
              const current = Schema.decodeUnknownSync(InvoiceRenderSnapshot)(
                JSON.parse(currentRecord.renderSnapshot),
              );
              const issueDate = invoiceIssueDate(now, businessConfig.timeZone);
              validateDates(current.serviceDate, current.dueDate, issueDate);
              const invoiceNumber = allocateBusinessReference(
                database.sqlite,
                'invoice',
                businessYear(now, businessConfig.timeZone),
              );
              const nextVersion = invoice.version + 1;
              const finalSnapshot = insertRevision({
                invoiceId,
                orderId: invoice.orderId,
                orderReference: current.orderReference,
                quoteReference: current.quoteReference,
                version: nextVersion,
                invoiceNumber,
                issuedAt: now,
                issuer: current.issuer,
                client: current.client,
                title: current.title,
                serviceDate: current.serviceDate,
                dueDate: current.dueDate,
                paymentTerms: current.paymentTerms,
                lines: current.lines,
                actorUserId,
                now,
              });
              const updated = database.sqlite
                .prepare(
                  `update invoices
                   set status = 'issued', version = ?, invoice_number = ?, issued_at = ?, updated_at = ?
                   where id = ? and status = 'draft' and version = ?`,
                )
                .run(
                  nextVersion,
                  invoiceNumber,
                  now,
                  now,
                  invoiceId,
                  request.expectedVersion,
                ).changes;
              if (updated !== 1) {
                throw new InvoiceVersionConflict({
                  code: 'invoice.version_conflict',
                  currentVersion: invoice.version,
                });
              }
              audit.insert({
                action: 'invoice.issued',
                actorUserId,
                resourceType: 'invoice',
                resourceId: invoiceId,
                metadata: {
                  invoiceNumber,
                  revisionId: finalSnapshot.revisionId,
                  version: String(nextVersion),
                },
                occurredAt: now,
              });
              database.sqlite
                .prepare(
                  `insert into invoice_pdf_jobs
                   (invoice_revision_id, invoice_id, invoice_number, version, actor_user_id,
                    status, attempts, error, created_at, updated_at)
                   values (?, ?, ?, ?, ?, 'pending', 0, null, ?, ?)`,
                )
                .run(
                  finalSnapshot.revisionId,
                  invoiceId,
                  invoiceNumber,
                  nextVersion,
                  actorUserId,
                  now,
                  now,
                );
              return InvoiceIssueResult.make({
                invoiceId,
                revisionId: finalSnapshot.revisionId,
                version: nextVersion,
                status: 'issued',
                invoiceNumber,
                issuedAt: DateTime.formatIso(DateTime.makeUnsafe(now)),
              });
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof InvoiceNotFound ||
            cause instanceof InvoiceVersionConflict ||
            cause instanceof InvoiceInvalidDates ||
            cause instanceof InvoiceInvalidTransition
          ) {
            return cause;
          }
          return new DatabaseError({ operation: 'issue.invoice', cause });
        },
      });
    });

    const transition = Effect.fn('Invoices.transition')(function* (
      invoiceId: UlidValue,
      request: InvoiceTransitionRequestValue,
      actorUserId: UlidValue,
      targetStatus: 'paid' | 'void',
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const rawInvoice = database.sqlite
                .prepare(`${invoiceSql} where id = ?`)
                .get(invoiceId);
              if (rawInvoice === undefined) {
                throw new InvoiceNotFound({ code: 'invoice.not_found' });
              }
              const invoice = Schema.decodeUnknownSync(InvoiceRecord)(rawInvoice);
              if (invoice.version !== request.expectedVersion) {
                throw new InvoiceVersionConflict({
                  code: 'invoice.version_conflict',
                  currentVersion: invoice.version,
                });
              }
              if (invoice.status === targetStatus) {
                const detail = readDetail(invoiceId);
                if (detail === undefined) throw new Error('invoice.transitioned.missing');
                return detail;
              }
              if (invoice.status !== 'issued') {
                throw new InvoiceInvalidTransition({
                  code: 'invoice.invalid_transition',
                  currentStatus: invoice.status,
                });
              }
              const paidAt = targetStatus === 'paid' ? now : null;
              const voidedAt = targetStatus === 'void' ? now : null;
              const updated = database.sqlite
                .prepare(
                  `update invoices set status = ?, paid_at = ?, voided_at = ?, updated_at = ?
                   where id = ? and status = 'issued' and version = ?`,
                )
                .run(
                  targetStatus,
                  paidAt,
                  voidedAt,
                  now,
                  invoiceId,
                  request.expectedVersion,
                ).changes;
              if (updated !== 1) {
                throw new InvoiceVersionConflict({
                  code: 'invoice.version_conflict',
                  currentVersion: invoice.version,
                });
              }
              audit.insert({
                action: targetStatus === 'paid' ? 'invoice.marked-paid' : 'invoice.voided',
                actorUserId,
                resourceType: 'invoice',
                resourceId: invoiceId,
                metadata: { status: targetStatus, version: String(invoice.version) },
                occurredAt: now,
              });
              const detail = readDetail(invoiceId);
              if (detail === undefined) throw new Error('invoice.transitioned.missing');
              return detail;
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof InvoiceNotFound ||
            cause instanceof InvoiceVersionConflict ||
            cause instanceof InvoiceInvalidTransition
          ) {
            return cause;
          }
          return new DatabaseError({ operation: `mark.invoice.${targetStatus}`, cause });
        },
      });
    });

    const markPaid = Effect.fn('Invoices.markPaid')(
      (invoiceId: UlidValue, request: InvoiceTransitionRequestValue, actorUserId: UlidValue) =>
        transition(invoiceId, request, actorUserId, 'paid'),
    );
    const voidInvoice = Effect.fn('Invoices.void')(
      (invoiceId: UlidValue, request: InvoiceTransitionRequestValue, actorUserId: UlidValue) =>
        transition(invoiceId, request, actorUserId, 'void'),
    );

    return Invoices.of({
      list,
      get,
      getSnapshot,
      create,
      createRevision,
      issue,
      markPaid,
      voidInvoice,
    });
  }),
);
