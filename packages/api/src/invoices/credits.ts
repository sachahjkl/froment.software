import {
  CreditNote,
  CreditNoteDraftRequest,
  CreditNoteDraftUpdate,
  CreditNoteIssueRequest,
  CreditNoteLine,
  CreditNoteRevision,
  InvoiceCreditConflict,
  InvoiceCreditRequestConflict,
  InvoiceCredits,
  InvoiceRefund,
  InvoiceRefundRequest,
  InvoiceRefundCancel,
  InvoiceRenderSnapshot,
  CreditNoteLineRequest,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { allocateBusinessReference, businessYear } from '../business/business-references.js';
import { calculateDocumentLine, calculateDocumentTotals } from '../documents/calculation.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import { verifyArtifactContent } from '../documents/artifact-integrity.js';
import { invoiceIssueDate } from './invoices.js';

const creditQuery = `select id, client_id as clientId, status, version, request_id as requestId,
  issue_request_id as issueRequestId, number, reason, currency, created_at as createdAt,
  created_by_user_id as createdByUserId, issued_at as issuedAt,
  issued_by_user_id as issuedByUserId, net_total_cents as netTotalCents,
  vat_total_cents as vatTotalCents, total_cents as totalCents from invoice_credit_notes`;
const lineQuery = `select id, invoice_id as invoiceId, invoice_version as invoiceVersion,
  invoice_number as invoiceNumber, source_line_id as sourceLineId, position, description,
  quantity_milli as quantityMilli, unit_price_cents as unitPriceCents,
  vat_rate_basis_points as vatRateBasisPoints, net_total_cents as netTotalCents,
  vat_total_cents as vatTotalCents, total_cents as totalCents from invoice_credit_note_lines`;
const revisionQuery = `select id, version, reason, created_at as createdAt,
  created_by_user_id as createdByUserId, net_total_cents as netTotalCents,
  vat_total_cents as vatTotalCents, total_cents as totalCents
  from invoice_credit_note_revisions`;
const CreditNoteRow = Schema.Struct({
  id: CreditNote.fields.id,
  clientId: CreditNote.fields.clientId,
  status: CreditNote.fields.status,
  version: CreditNote.fields.version,
  requestId: CreditNote.fields.requestId,
  issueRequestId: CreditNote.fields.issueRequestId,
  number: CreditNote.fields.number,
  reason: CreditNote.fields.reason,
  currency: CreditNote.fields.currency,
  createdAt: CreditNote.fields.createdAt,
  createdByUserId: CreditNote.fields.createdByUserId,
  issuedAt: CreditNote.fields.issuedAt,
  issuedByUserId: CreditNote.fields.issuedByUserId,
  netTotalCents: CreditNote.fields.netTotalCents,
  vatTotalCents: CreditNote.fields.vatTotalCents,
  totalCents: CreditNote.fields.totalCents,
});
const refundQuery =
  'select id, invoice_id as invoiceId, request_id as requestId, amount_cents as amountCents, refunded_on as refundedOn, reference, recorded_at as recordedAt, recorded_by_user_id as recordedByUserId, cancelled_at as cancelledAt, cancelled_by_user_id as cancelledByUserId, cancellation_reason as cancellationReason from invoice_refunds';
const SourceInvoice = Schema.Struct({
  clientId: Schema.String,
  status: Schema.String,
  version: Schema.Int,
  invoiceNumber: Schema.NullOr(Schema.String),
  snapshot: Schema.fromJsonString(InvoiceRenderSnapshot),
});

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const business = yield* BusinessConfig;
  const renderer = yield* DocumentRenderer;
  const conflict = () => new InvoiceCreditConflict({ code: 'invoice.credit_conflict' });
  const requestConflict = () =>
    new InvoiceCreditRequestConflict({ code: 'invoice.credit_request_conflict' });

  const readNote = (creditNoteId: string) => {
    const row = sqlite.prepare(`${creditQuery} where id = ?`).get(creditNoteId);
    if (row === undefined) throw conflict();
    const note = Schema.decodeUnknownSync(CreditNoteRow)(row);
    const revisions = Schema.decodeUnknownSync(
      Schema.Array(
        Schema.Struct({
          id: CreditNoteRevision.fields.id,
          version: CreditNoteRevision.fields.version,
          reason: CreditNoteRevision.fields.reason,
          createdAt: CreditNoteRevision.fields.createdAt,
          createdByUserId: CreditNoteRevision.fields.createdByUserId,
          netTotalCents: CreditNoteRevision.fields.netTotalCents,
          vatTotalCents: CreditNoteRevision.fields.vatTotalCents,
          totalCents: CreditNoteRevision.fields.totalCents,
        }),
      ),
    )(
      sqlite
        .prepare(`${revisionQuery} where credit_note_id = ? order by version`)
        .all(creditNoteId),
    ).map((revision) =>
      CreditNoteRevision.make({
        ...revision,
        lines: Schema.decodeUnknownSync(Schema.Array(CreditNoteLine))(
          sqlite
            .prepare(`${lineQuery} where credit_note_revision_id = ? order by position`)
            .all(revision.id),
        ),
      }),
    );
    const current = revisions.find((revision) => revision.version === note.version);
    if (current === undefined) throw conflict();
    return Schema.decodeUnknownSync(CreditNote)({ ...note, lines: current.lines, revisions });
  };

  const read = (invoiceId: string) => {
    if (sqlite.prepare('select 1 from invoices where id = ?').get(invoiceId) === undefined)
      throw conflict();
    const noteIds = Schema.decodeUnknownSync(Schema.Array(Schema.String))(
      sqlite
        .prepare(
          `select distinct n.id from invoice_credit_notes n
           join invoice_credit_note_lines l on l.credit_note_id = n.id
           where l.invoice_id = ? order by n.created_at, n.id`,
        )
        .pluck()
        .all(invoiceId),
    );
    const creditNotes = noteIds.map(readNote);
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
    const invoiceTotal = Schema.decodeUnknownSync(Schema.Int)(
      sqlite
        .prepare(
          `select revisions.total_cents from invoices
           join invoice_revisions revisions
             on revisions.invoice_id = invoices.id and revisions.version = invoices.version
           where invoices.id = ?`,
        )
        .pluck()
        .get(invoiceId),
    );
    const credited = creditNotes.reduce(
      (sum, note) =>
        sum +
        (note.status === 'issued'
          ? note.lines
              .filter((line) => line.invoiceId === invoiceId)
              .reduce((lineSum, line) => lineSum + line.totalCents, 0)
          : 0),
      0,
    );
    const refunded = refunds.reduce(
      (sum, refund) => sum + (refund.cancelledAt === null ? BigInt(refund.amountCents) : 0n),
      0n,
    );
    return InvoiceCredits.make({
      creditNotes,
      refunds,
      refundableCents: Number(
        BigInt(paid + credited - invoiceTotal) - refunded > 0n
          ? BigInt(paid + credited - invoiceTotal) - refunded
          : 0n,
      ),
    });
  };

  const sourceInvoice = (request: typeof CreditNoteLineRequest.Type) => {
    const row = sqlite
      .prepare(
        `select i.client_id as clientId, i.status, i.version, i.invoice_number as invoiceNumber,
          r.render_snapshot as snapshot from invoices i join invoice_revisions r
          on r.invoice_id = i.id and r.version = i.version where i.id = ?`,
      )
      .get(request.invoiceId);
    if (row === undefined) throw conflict();
    const invoice = Schema.decodeUnknownSync(SourceInvoice)(row);
    if (
      !['issued', 'paid'].includes(invoice.status) ||
      invoice.version !== request.invoiceVersion ||
      invoice.invoiceNumber === null ||
      invoice.snapshot.invoiceNumber === null
    )
      throw conflict();
    return invoice;
  };

  const buildLines = (
    requests: ReadonlyArray<typeof CreditNoteLineRequest.Type>,
    excludedCreditNoteId: string | null,
  ) => {
    const keys = new Set<string>();
    let expectedClientId: string | undefined;
    let expectedCurrency: string | undefined;
    const lines = requests.map((request, position) => {
      const key = `${request.invoiceId}:${request.sourceLineId}`;
      if (keys.has(key)) throw conflict();
      keys.add(key);
      const invoice = sourceInvoice(request);
      expectedClientId ??= invoice.clientId;
      expectedCurrency ??= invoice.snapshot.currency;
      if (invoice.clientId !== expectedClientId || invoice.snapshot.currency !== expectedCurrency)
        throw conflict();
      const source = invoice.snapshot.lines.find((line) => line.id === request.sourceLineId);
      if (source === undefined) throw conflict();
      const credited = Schema.decodeUnknownSync(Schema.Int)(
        sqlite
          .prepare(
            `select coalesce(sum(l.quantity_milli), 0) from invoice_credit_note_lines l
             join invoice_credit_notes n on n.id = l.credit_note_id
             join invoice_credit_note_revisions r on r.id = l.credit_note_revision_id
             where l.invoice_id = ? and l.source_line_id = ? and n.status = 'issued'
             and r.version = n.version
             and (? is null or n.id <> ?)`,
          )
          .pluck()
          .get(request.invoiceId, request.sourceLineId, excludedCreditNoteId, excludedCreditNoteId),
      );
      if (request.quantityMilli > source.quantityMilli - credited) throw conflict();
      const amounts = calculateDocumentLine({
        description: source.description,
        quantityMilli: request.quantityMilli,
        unitPriceCents: source.unitPriceCents,
        vatRateBasisPoints: source.vatRateBasisPoints,
      });
      return {
        id: ulid(),
        invoiceId: request.invoiceId,
        invoiceRevisionId: invoice.snapshot.revisionId,
        invoiceVersion: request.invoiceVersion,
        invoiceNumber: invoice.invoiceNumber,
        sourceLineId: request.sourceLineId,
        position,
        description: source.description,
        quantityMilli: request.quantityMilli,
        unitPriceCents: source.unitPriceCents,
        vatRateBasisPoints: source.vatRateBasisPoints,
        ...amounts,
      };
    });
    if (expectedClientId === undefined || expectedCurrency === undefined) throw conflict();
    return {
      lines,
      clientId: expectedClientId,
      currency: expectedCurrency,
      ...calculateDocumentTotals(lines),
    };
  };

  const storedRequests = (note: typeof CreditNote.Type) =>
    note.lines.map((line) => ({
      invoiceId: line.invoiceId,
      invoiceVersion: line.invoiceVersion,
      sourceLineId: line.sourceLineId,
      quantityMilli: line.quantityMilli,
    }));

  const insertRevision = (
    creditNoteId: string,
    version: number,
    reason: string,
    createdAt: string,
    actor: string,
    totals: Pick<ReturnType<typeof buildLines>, 'netTotalCents' | 'vatTotalCents' | 'totalCents'>,
    lines: ReturnType<typeof buildLines>['lines'],
  ) => {
    const revisionId = ulid();
    sqlite
      .prepare(
        `insert into invoice_credit_note_revisions
         (id, credit_note_id, version, reason, created_at, created_by_user_id,
          net_total_cents, vat_total_cents, total_cents) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        revisionId,
        creditNoteId,
        version,
        reason,
        createdAt,
        actor,
        totals.netTotalCents,
        totals.vatTotalCents,
        totals.totalCents,
      );
    const insert = sqlite.prepare(`insert into invoice_credit_note_lines
      (id, credit_note_id, credit_note_revision_id, invoice_id, invoice_revision_id, invoice_version, invoice_number,
       source_line_id, position, description, quantity_milli, unit_price_cents,
       vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const line of lines)
      insert.run(
        line.id,
        creditNoteId,
        revisionId,
        line.invoiceId,
        line.invoiceRevisionId,
        line.invoiceVersion,
        line.invoiceNumber,
        line.sourceLineId,
        line.position,
        line.description,
        line.quantityMilli,
        line.unitPriceCents,
        line.vatRateBasisPoints,
        line.netTotalCents,
        line.vatTotalCents,
        line.totalCents,
      );
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

  const getNote = Effect.fn('InvoiceCredits.getNote')((creditNoteId: string) =>
    Effect.try({
      try: () => readNote(creditNoteId),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict
          ? cause
          : new DatabaseError({ operation: 'credit.get', cause }),
    }),
  );

  const create = Effect.fn('InvoiceCredits.create')(function* (
    request: typeof CreditNoteDraftRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const priorId = sqlite
              .prepare('select id from invoice_credit_notes where request_id = ?')
              .pluck()
              .get(request.requestId);
            if (priorId !== undefined) {
              const prior = readNote(Schema.decodeUnknownSync(Schema.String)(priorId));
              if (
                prior.reason !== request.reason.trim() ||
                JSON.stringify(storedRequests(prior)) !== JSON.stringify(request.lines)
              )
                throw requestConflict();
              return prior;
            }
            const built = buildLines(request.lines, null);
            const id = ulid(now);
            sqlite
              .prepare(
                `insert into invoice_credit_notes
                (id, client_id, request_id, status, version, reason, currency, created_at,
                 created_by_user_id, net_total_cents, vat_total_cents, total_cents)
                values (?, ?, ?, 'draft', 1, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .run(
                id,
                built.clientId,
                request.requestId,
                request.reason.trim(),
                built.currency,
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actor,
                built.netTotalCents,
                built.vatTotalCents,
                built.totalCents,
              );
            const createdAt = DateTime.formatIso(DateTime.makeUnsafe(now));
            insertRevision(id, 1, request.reason.trim(), createdAt, actor, built, built.lines);
            return readNote(id);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict || cause instanceof InvoiceCreditRequestConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.credit.create', cause }),
    });
  });

  const update = Effect.fn('InvoiceCredits.update')(function* (
    creditNoteId: string,
    request: typeof CreditNoteDraftUpdate.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const saved = readNote(creditNoteId);
            if (saved.status !== 'draft' || saved.version !== request.expectedVersion)
              throw conflict();
            const built = buildLines(request.lines, creditNoteId);
            if (saved.clientId !== built.clientId || saved.currency !== built.currency)
              throw conflict();
            sqlite
              .prepare(
                `update invoice_credit_notes set version = version + 1, reason = ?,
                 net_total_cents = ?, vat_total_cents = ?, total_cents = ? where id = ?`,
              )
              .run(
                request.reason.trim(),
                built.netTotalCents,
                built.vatTotalCents,
                built.totalCents,
                creditNoteId,
              );
            insertRevision(
              creditNoteId,
              saved.version + 1,
              request.reason.trim(),
              DateTime.formatIso(DateTime.makeUnsafe(now)),
              actor,
              built,
              built.lines,
            );
            return readNote(creditNoteId);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict || cause instanceof InvoiceCreditRequestConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.credit.update', cause }),
    });
  });

  const issue = Effect.fn('InvoiceCredits.issue')(function* (
    creditNoteId: string,
    request: typeof CreditNoteIssueRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const saved = readNote(creditNoteId);
            if (saved.status === 'issued') {
              if (saved.issueRequestId !== request.requestId) throw requestConflict();
              return saved;
            }
            if (saved.version !== request.expectedVersion) throw conflict();
            const rebuilt = buildLines(storedRequests(saved), creditNoteId);
            if (
              rebuilt.netTotalCents !== saved.netTotalCents ||
              rebuilt.vatTotalCents !== saved.vatTotalCents ||
              rebuilt.totalCents !== saved.totalCents
            )
              throw conflict();
            const number = allocateBusinessReference(
              sqlite,
              'credit-note',
              businessYear(now, business.timeZone),
            );
            const issuedAt = DateTime.formatIso(DateTime.makeUnsafe(now));
            sqlite
              .prepare(
                `update invoice_credit_notes set status = 'issued',
                 issue_request_id = ?, number = ?, issued_at = ?, issued_by_user_id = ? where id = ?`,
              )
              .run(request.requestId, number, issuedAt, actor, creditNoteId);
            for (const invoiceId of new Set(saved.lines.map((line) => line.invoiceId)))
              audit.insert({
                action: 'invoice.credited',
                actorUserId: actor,
                resourceType: 'invoice',
                resourceId: invoiceId,
                occurredAt: now,
                metadata: {
                  creditNoteId,
                  number,
                  totalCents: String(
                    saved.lines
                      .filter((line) => line.invoiceId === invoiceId)
                      .reduce((total, line) => total + line.totalCents, 0),
                  ),
                },
              });
            return readNote(creditNoteId);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof InvoiceCreditConflict || cause instanceof InvoiceCreditRequestConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.credit.issue', cause }),
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
                throw requestConflict();
              return read(invoiceId);
            }
            const state = read(invoiceId);
            const issuedAt = state.creditNotes
              .filter((note) => note.status === 'issued')
              .map((note) => note.issuedAt)
              .filter(Schema.is(Schema.String))
              .sort()[0];
            if (
              issuedAt === undefined ||
              !Schema.is(InvoiceRefundRequest)(request) ||
              request.amountCents > state.refundableCents ||
              request.refundedOn > invoiceIssueDate(now, business.timeZone) ||
              request.refundedOn < invoiceIssueDate(Date.parse(issuedAt), business.timeZone)
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
        cause instanceof InvoiceCreditConflict || cause instanceof InvoiceCreditRequestConflict
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
            const saved = read(invoiceId).refunds.find((entry) => entry.id === refundId);
            if (saved === undefined) throw conflict();
            if (saved.cancelledAt !== null) {
              if (saved.cancellationReason !== request.reason.trim()) throw requestConflict();
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
        cause instanceof InvoiceCreditConflict || cause instanceof InvoiceCreditRequestConflict
          ? cause
          : new DatabaseError({ operation: 'invoice.refund.cancel', cause }),
    });
  });

  const pdf = Effect.fn('InvoiceCredits.pdf')(function* (creditNoteId: string) {
    const note = yield* Effect.try({
      try: () => readNote(creditNoteId),
      catch: () => conflict(),
    });
    if (note.status !== 'issued' || note.number === null || note.issuedAt === null)
      return yield* conflict();
    const readPdf = () => {
      const row = sqlite
        .prepare(
          'select content, sha256 from invoice_credit_note_artifacts where credit_note_id = ?',
        )
        .get(note.id);
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
    const firstLine = note.lines[0];
    if (firstLine === undefined) return yield* conflict();
    const source = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.fromJsonString(InvoiceRenderSnapshot))(
          sqlite
            .prepare(
              'select render_snapshot from invoice_revisions where invoice_id = ? and version = ?',
            )
            .pluck()
            .get(firstLine.invoiceId, firstLine.invoiceVersion),
        ),
      catch: (cause) => new DatabaseError({ operation: 'credit.snapshot.read', cause }),
    });
    const multiInvoice = new Set(note.lines.map((line) => line.invoiceId)).size > 1;
    const snapshot = InvoiceRenderSnapshot.make({
      ...source,
      lines: note.lines.map((line) => ({
        id: line.id,
        position: line.position,
        description: multiInvoice
          ? `${line.invoiceNumber} — ${line.description}`
          : line.description,
        quantityMilli: line.quantityMilli,
        unitPriceCents: line.unitPriceCents,
        vatRateBasisPoints: line.vatRateBasisPoints,
        netTotalCents: line.netTotalCents,
        vatTotalCents: line.vatTotalCents,
        totalCents: line.totalCents,
      })),
      netTotalCents: note.netTotalCents,
      vatTotalCents: note.vatTotalCents,
      totalCents: note.totalCents,
    });
    const issuedOn = invoiceIssueDate(Date.parse(note.issuedAt), business.timeZone);
    const content = yield* renderer.renderCreditNotePdf(snapshot, note, issuedOn);
    const now = yield* Clock.currentTimeMillis;
    const result = yield* Effect.try({
      try: () => {
        sqlite
          .prepare(
            'insert or ignore into invoice_credit_note_artifacts (credit_note_id, content, byte_size, sha256, created_at) values (?, ?, ?, ?, ?)',
          )
          .run(
            note.id,
            Buffer.from(content),
            content.byteLength,
            createHash('sha256').update(content).digest('hex'),
            DateTime.formatIso(DateTime.makeUnsafe(now)),
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
    creditNoteId: string,
    clientId: string,
  ) {
    const owns = yield* Effect.try({
      try: () =>
        sqlite
          .prepare('select 1 from invoice_credit_notes where id = ? and client_id = ?')
          .get(creditNoteId, clientId) !== undefined,
      catch: (cause) => new DatabaseError({ operation: 'credit.client.check', cause }),
    });
    if (!owns) return yield* conflict();
    return yield* pdf(creditNoteId);
  });

  return { get, getNote, create, update, issue, refund, cancelRefund, pdf, clientPdf };
});

export class InvoiceCreditNotes extends Context.Service<
  InvoiceCreditNotes,
  Effect.Success<typeof make>
>()('@froment/api/InvoiceCreditNotes') {}

export const InvoiceCreditNotesLive = Layer.effect(InvoiceCreditNotes, make);
