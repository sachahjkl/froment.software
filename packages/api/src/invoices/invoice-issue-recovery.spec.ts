import { InvoiceRenderSnapshot, type IssuerSettingsValue } from '@froment/contracts';
import { DateTime, Deferred, Effect, Fiber, Layer, Schema } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TestClock } from 'effect/testing';

import { AuditLive } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { ClientPortal, ClientPortalLive } from '../client-portal/client-portal.js';
import { Database, type DatabaseService } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { DocumentArtifacts, DocumentArtifactsLive } from '../documents/document-artifacts.js';
import {
  DocumentRenderer,
  DocumentRenderError,
  type DocumentRendererService,
} from '../documents/document-renderer.js';
import { IssuerSettings, type IssuerSettingsService } from '../issuer-settings/service.js';
import { OrdersLive } from '../orders/orders.js';
import { Quotes, type QuotesService } from '../quotes/quotes.js';
import { issueInvoice } from './issue.js';
import { InvoicePdfJobs, InvoicePdfJobsLive } from './pdf-jobs.js';
import { Invoices, InvoicesLive } from './invoices.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const clientId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const revisionId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';
const lineId = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const quoteRevisionId = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
const quoteLinkId = '01ARZ3NDEKTSV4RRFFQ69G5FB3';
const auditEventId = '01ARZ3NDEKTSV4RRFFQ69G5FB4';
const signatureId = '01ARZ3NDEKTSV4RRFFQ69G5FB5';
const issuer: IssuerSettingsValue = {
  displayName: 'Froment Software',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  phone: '',
  registrationNumber: '',
  vatNumber: '',
};
const snapshot = Schema.decodeUnknownSync(InvoiceRenderSnapshot)({
  templateId: 'invoice-default',
  templateVersion: 1,
  invoiceId,
  orderId,
  orderReference: 'CO-2026-000001',
  quoteReference: 'DE-2026-000001',
  revisionId,
  version: 1,
  createdAt: '2026-08-20T10:00:00.000Z',
  invoiceNumber: null,
  issuedAt: null,
  serviceDate: '2026-08-20',
  dueDate: '2099-09-19',
  issuer,
  client: {
    displayName: 'Client',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: '',
    email: '',
  },
  title: 'Invoice',
  paymentTerms: 'Payment due within 30 days.',
  currency: 'EUR',
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
  lines: [
    {
      id: lineId,
      position: 0,
      description: 'Service',
      quantityMilli: 1_000,
      unitPriceCents: 10_000,
      vatRateBasisPoints: 2_000,
      netTotalCents: 10_000,
      vatTotalCents: 2_000,
      totalCents: 12_000,
    },
  ],
});

const issuerSettings: IssuerSettingsService = {
  get: Effect.succeed(issuer),
  update: () => Effect.succeed(issuer),
};
const unused = () => Effect.die('The invoice PDF test does not use quote operations.');
const quotes: QuotesService = {
  list: unused(),
  get: unused,
  getSnapshot: unused,
  create: unused,
  createRevision: unused,
  cancel: unused,
};

const makeTestLayer = (filename: string, renderer: DocumentRendererService) => {
  const databaseLayer = makeMigratedDatabaseLayer({
    filename,
    migrationsFolder: join(import.meta.dirname, '../..', 'drizzle'),
  });
  const coreLayer = Layer.mergeAll(
    InvoicesLive,
    OrdersLive,
    Layer.succeed(DocumentRenderer, renderer),
    Layer.succeed(Quotes, quotes),
  ).pipe(Layer.provideMerge(Layer.succeed(IssuerSettings, issuerSettings)));
  const configuredCoreLayer = coreLayer.pipe(
    Layer.provideMerge(
      Layer.succeed(BusinessConfig, {
        timeZone: DateTime.zoneMakeNamedUnsafe('Europe/Paris'),
      }),
    ),
  );
  const artifactLayer = DocumentArtifactsLive.pipe(
    Layer.provideMerge(configuredCoreLayer),
    Layer.provide(AuditLive),
    Layer.provideMerge(databaseLayer),
  );
  const jobLayer = InvoicePdfJobsLive.pipe(Layer.provideMerge(artifactLayer));
  return Layer.merge(jobLayer, ClientPortalLive.pipe(Layer.provide(jobLayer)));
};

const seedInvoice = (database: DatabaseService, dueDate = '2099-09-19') => {
  database.sqlite.pragma('foreign_keys = OFF');
  database.sqlite
    .prepare(
      `insert into users (id, display_name, kind, created_at, updated_at)
       values (?, 'Administrator', 'administrator', 1, 1)`,
    )
    .run(actorId);
  database.sqlite
    .prepare(
      `insert into users (id, display_name, kind, created_at, updated_at)
       values (?, 'Client', 'client', 1, 1)`,
    )
    .run(clientId);
  database.sqlite
    .prepare(
      `insert into clients (id, created_at, updated_at, address_line_1, address_line_2,
                            postal_code, city, country, email)
       values (?, 1, 1, '', '', '', '', '', '')`,
    )
    .run(clientId);
  database.sqlite
    .prepare(
      `insert into quotes (id, reference, client_id, status, version, created_at, updated_at)
       values (?, 'DE-2026-000001', ?, 'accepted', 1, 1, 1)`,
    )
    .run(quoteId, clientId);
  database.sqlite
    .prepare(
      `insert into quote_revisions
       (id, quote_id, version, client_display_name, title, conditions, currency,
        net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id)
       values (?, ?, 1, 'Client', 'Quote', '', 'EUR', 10000, 2000, 12000, 1, ?)`,
    )
    .run(quoteRevisionId, quoteId, actorId);
  database.sqlite
    .prepare(
      `insert into quote_links
       (id, revision_id, token_hmac, usage_policy, created_at, expires_at, consumed_at)
       values (?, ?, ?, 'single-use', 1, 2, 1)`,
    )
    .run(quoteLinkId, quoteRevisionId, Buffer.alloc(32, 1));
  database.sqlite
    .prepare(
      `insert into audit_events
       (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
       values (?, 'quote.accepted', null, 'quote', ?, 1, '{}')`,
    )
    .run(auditEventId, quoteId);
  database.sqlite
    .prepare(
      `insert into quote_signatures
       (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind,
        signature_value, signed_at, ip_address, user_agent, snapshot_sha256, pdf_sha256,
        audit_event_id, evidence_content, evidence_sha256)
       values (?, ?, ?, ?, 'Client', 1, 'typed', 'Client', 1, '127.0.0.1', '', ?, ?, ?, ?, ?)`,
    )
    .run(
      signatureId,
      quoteId,
      quoteRevisionId,
      quoteLinkId,
      'a'.repeat(64),
      'b'.repeat(64),
      auditEventId,
      Buffer.from('evidence'),
      'c'.repeat(64),
    );
  database.sqlite
    .prepare(
      `insert into orders
       (id, reference, quote_id, revision_id, client_id, signature_id, status, created_at)
        values (?, 'CO-2026-000001', ?, ?, ?, ?, 'confirmed', 1)`,
    )
    .run(orderId, quoteId, quoteRevisionId, clientId, signatureId);
  database.sqlite
    .prepare(
      `insert into invoices
       (id, order_id, client_id, status, version, created_at, updated_at)
       values (?, ?, ?, 'draft', 1, 1, 1)`,
    )
    .run(invoiceId, orderId, clientId);
  database.sqlite
    .prepare(
      `insert into invoice_revisions
       (id, invoice_id, version, invoice_number, issued_at, client_display_name, title,
        service_date, due_date, payment_terms, currency, net_total_cents, vat_total_cents,
        total_cents, created_at, created_by_user_id, template_id, template_version,
        render_snapshot)
        values (?, ?, 1, null, null, 'Client', 'Invoice', '2026-08-20', ?,
                'Payment due within 30 days.', 'EUR', 10000, 2000, 12000, 1, ?,
                 'invoice-default', 1, ?)`,
    )
    .run(revisionId, invoiceId, dueDate, actorId, JSON.stringify({ ...snapshot, dueDate }));
  database.sqlite
    .prepare(
      `insert into invoice_lines
       (id, revision_id, position, description, quantity_milli, unit_price_cents,
        vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
       values (?, ?, 0, 'Service', 1000, 10000, 2000, 10000, 2000, 12000)`,
    )
    .run(lineId, revisionId);
  database.sqlite.pragma('foreign_keys = ON');
};

describe('invoice issue recovery', () => {
  it('validates the due date against the Paris issue date after UTC midnight', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const invoices = yield* Invoices;
        seedInvoice(database, '2026-08-20');
        const localMidnight = DateTime.toEpochMillis(
          DateTime.makeUnsafe('2026-08-20T22:00:00.000Z'),
        );
        yield* TestClock.setTime(localMidnight);
        return yield* Effect.result(invoices.issue(invoiceId, { expectedVersion: 1 }, actorId));
      }).pipe(
        Effect.provide(
          makeTestLayer(':memory:', {
            renderQuotePdf: () => Effect.die('unused'),
            renderInvoicePdf: () => Effect.die('unused'),
            renderOrderPdf: () => Effect.die('unused'),
          }),
        ),
        Effect.provide(TestClock.layer()),
      ),
    );

    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'InvoiceInvalidDates' },
    });
  });

  it('rejects corrupted invoice PDFs for administrator and client downloads', async () => {
    const pdf = Buffer.from('%PDF-corrupted');
    const renderer: DocumentRendererService = {
      renderQuotePdf: () => Effect.succeed(pdf),
      renderInvoicePdf: () => Effect.succeed(pdf),
      renderOrderPdf: () => Effect.die('unused'),
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const invoices = yield* Invoices;
        const artifacts = yield* DocumentArtifacts;
        const portal = yield* ClientPortal;
        seedInvoice(database);
        const issued = yield* invoices.issue(invoiceId, { expectedVersion: 1 }, actorId);
        const issuedRevisionId = database.sqlite
          .prepare('select id from invoice_revisions where invoice_id = ? and version = ?')
          .pluck()
          .get(invoiceId, issued.version);
        database.sqlite
          .prepare(
            `insert into document_artifacts
             (id, invoice_revision_id, kind, content_type, byte_size, sha256, content, created_at)
             values (?, ?, 'invoice-pdf', 'application/pdf', ?, ?, ?, 2)`,
          )
          .run('01ARZ3NDEKTSV4RRFFQ69G5FAW', issuedRevisionId, pdf.byteLength, '0'.repeat(64), pdf);
        database.sqlite
          .prepare(
            "update invoice_pdf_jobs set status = 'ready', attempts = 1 where invoice_id = ?",
          )
          .run(invoiceId);
        return {
          administrator: yield* Effect.result(artifacts.getInvoicePdf(invoiceId, issued.version)),
          client: yield* Effect.result(portal.getInvoicePdf(clientId, invoiceId)),
        };
      }).pipe(Effect.provide(makeTestLayer(':memory:', renderer))),
    );

    expect(result.administrator._tag).toBe('Failure');
    expect(result.client._tag).toBe('Failure');
  });

  it('reuses the issued revision and number after PDF rendering fails', async () => {
    let renderAttempts = 0;
    const pdf = new TextEncoder().encode('%PDF-1.7\nrecovered');
    const renderer: DocumentRendererService = {
      renderQuotePdf: () => Effect.succeed(pdf),
      renderInvoicePdf: () => {
        renderAttempts += 1;
        return renderAttempts === 1
          ? Effect.fail(new DocumentRenderError({ reason: 'compiler' }))
          : Effect.succeed(pdf);
      },
      renderOrderPdf: () => Effect.die('unused'),
    };
    const testLayer = makeTestLayer(':memory:', renderer);

    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const invoices = yield* Invoices;
        const artifacts = yield* DocumentArtifacts;
        const jobs = yield* InvoicePdfJobs;
        seedInvoice(database);

        const firstIssue = yield* invoices.issue(invoiceId, { expectedVersion: 1 }, actorId);
        yield* jobs.runPending();
        const secondIssue = yield* invoices.issue(invoiceId, { expectedVersion: 1 }, actorId);
        const finalVersionRetry = yield* invoices.issue(invoiceId, { expectedVersion: 2 }, actorId);
        const failedJob = database.sqlite
          .prepare('select status, attempts, error from invoice_pdf_jobs')
          .get();
        yield* jobs.runPending();
        const artifact = yield* artifacts.renderInvoicePdf(invoiceId, secondIssue.version, actorId);
        const content = yield* artifacts.getInvoicePdf(invoiceId, secondIssue.version);
        return {
          firstIssue,
          secondIssue,
          finalVersionRetry,
          failedJob,
          artifact,
          content,
          invoice: database.sqlite
            .prepare(
              'select status, version, invoice_number as invoiceNumber from invoices where id = ?',
            )
            .get(invoiceId),
          revisionCount: database.sqlite
            .prepare('select count(*) from invoice_revisions where invoice_id = ?')
            .pluck()
            .get(invoiceId),
          nextNumber: database.sqlite
            .prepare(
              "select next_value from business_reference_counters where kind = 'invoice' and year = 2026",
            )
            .pluck()
            .get(),
        };
      }).pipe(Effect.provide(testLayer), Effect.scoped),
    );

    expect(state.failedJob).toEqual({
      status: 'failed',
      attempts: 1,
      error: 'pdf.render_failed',
    });
    expect(state.secondIssue).toEqual(state.firstIssue);
    expect(state.finalVersionRetry).toEqual(state.firstIssue);
    expect(state.invoice).toEqual({
      status: 'issued',
      version: 2,
      invoiceNumber: 'FA-2026-000001',
    });
    expect(state.revisionCount).toBe(2);
    expect(state.nextNumber).toBe(2);
    expect(state.artifact).toMatchObject({ invoiceRevisionId: state.firstIssue.revisionId });
    expect(Buffer.from(state.content)).toEqual(Buffer.from(pdf));
    expect(renderAttempts).toBe(2);
  });

  it('returns issuance success when the immediate renderer fails', async () => {
    const renderer: DocumentRendererService = {
      renderQuotePdf: () => Effect.die('unused'),
      renderInvoicePdf: () => Effect.fail(new DocumentRenderError({ reason: 'compiler' })),
      renderOrderPdf: () => Effect.die('unused'),
    };
    const testLayer = makeTestLayer(':memory:', renderer);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedInvoice(database);
        const issued = yield* issueInvoice(invoiceId, { expectedVersion: 1 }, actorId);
        return {
          issued,
          job: database.sqlite
            .prepare('select status, attempts, error from invoice_pdf_jobs')
            .get(),
        };
      }).pipe(Effect.provide(testLayer), Effect.scoped),
    );

    expect(result.issued).toMatchObject({ status: 'issued', invoiceNumber: 'FA-2026-000001' });
    expect(result.job).toEqual({
      status: 'failed',
      attempts: 1,
      error: 'pdf.render_failed',
    });
    expect(JSON.stringify(result.job)).not.toContain('secret renderer detail');
  });

  it('claims one job and stores one artifact under concurrent workers', async () => {
    const started = Effect.runSync(Deferred.make<void>());
    const release = Effect.runSync(Deferred.make<void>());
    let attempts = 0;
    const pdf = new TextEncoder().encode('%PDF-1.7\nconcurrent');
    const renderer: DocumentRendererService = {
      renderQuotePdf: () => Effect.die('unused'),
      renderInvoicePdf: () => {
        attempts += 1;
        return Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.as(pdf),
        );
      },
      renderOrderPdf: () => Effect.die('unused'),
    };

    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const invoices = yield* Invoices;
        const jobs = yield* InvoicePdfJobs;
        seedInvoice(database);
        const issued = yield* Effect.all(
          [
            invoices.issue(invoiceId, { expectedVersion: 1 }, actorId),
            invoices.issue(invoiceId, { expectedVersion: 1 }, actorId),
          ],
          { concurrency: 'unbounded' },
        );
        const firstWorker = yield* jobs.runPending().pipe(Effect.forkChild);
        yield* Deferred.await(started);
        yield* jobs.runPending();
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(firstWorker);
        return {
          issued,
          jobs: database.sqlite.prepare('select count(*) from invoice_pdf_jobs').pluck().get(),
          artifacts: database.sqlite
            .prepare("select count(*) from document_artifacts where kind = 'invoice-pdf'")
            .pluck()
            .get(),
          revisions: database.sqlite
            .prepare('select count(*) from invoice_revisions where invoice_id = ?')
            .pluck()
            .get(invoiceId),
        };
      }).pipe(Effect.provide(makeTestLayer(':memory:', renderer)), Effect.scoped),
    );

    expect(state.issued[0]).toEqual(state.issued[1]);
    expect(state).toMatchObject({ jobs: 1, artifacts: 1, revisions: 2 });
    expect(attempts).toBe(1);
  });

  it('recovers a processing job after a database restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'invoice-pdf-restart-'));
    const filename = join(directory, 'database.sqlite');
    const pdf = new TextEncoder().encode('%PDF-1.7\nrestart');
    const renderer: DocumentRendererService = {
      renderQuotePdf: () => Effect.die('unused'),
      renderInvoicePdf: () => Effect.succeed(pdf),
      renderOrderPdf: () => Effect.die('unused'),
    };

    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const database = yield* Database;
          const invoices = yield* Invoices;
          const artifacts = yield* DocumentArtifacts;
          seedInvoice(database);
          const issued = yield* invoices.issue(invoiceId, { expectedVersion: 1 }, actorId);
          database.sqlite
            .prepare(
              "update invoice_pdf_jobs set status = 'processing', attempts = 1 where status = 'pending'",
            )
            .run();
          yield* artifacts.renderInvoicePdf(invoiceId, issued.version, actorId);
        }).pipe(Effect.provide(makeTestLayer(filename, renderer)), Effect.scoped),
      );

      const state = await Effect.runPromise(
        Effect.gen(function* () {
          const database = yield* Database;
          const jobs = yield* InvoicePdfJobs;
          const portal = yield* ClientPortal;
          const beforeRecovery = yield* portal.listInvoices(clientId);
          yield* jobs.recoverInterrupted;
          yield* jobs.runPending();
          return {
            beforeRecovery,
            afterRecovery: yield* portal.listInvoices(clientId),
            job: database.sqlite
              .prepare('select status, attempts, error from invoice_pdf_jobs')
              .get(),
            artifacts: database.sqlite
              .prepare("select count(*) from document_artifacts where kind = 'invoice-pdf'")
              .pluck()
              .get(),
          };
        }).pipe(Effect.provide(makeTestLayer(filename, renderer)), Effect.scoped),
      );

      expect(state).toEqual({
        beforeRecovery: [expect.objectContaining({ pdfAvailable: false })],
        afterRecovery: [expect.objectContaining({ pdfAvailable: true })],
        job: { status: 'ready', attempts: 2, error: null },
        artifacts: 1,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
