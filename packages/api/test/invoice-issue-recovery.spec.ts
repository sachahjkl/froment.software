import { InvoiceRenderSnapshot, type IssuerSettingsValue } from '@froment/contracts';
import { Effect, Layer, Schema } from 'effect';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../src/audit/audit.js';
import { Database, makeDatabaseLayer } from '../src/database/database.js';
import { DocumentArtifacts, DocumentArtifactsLive } from '../src/documents/document-artifacts.js';
import {
  DocumentRenderer,
  DocumentRenderError,
  type DocumentRendererService,
} from '../src/documents/document-renderer.js';
import { IssuerSettings, type IssuerSettingsService } from '../src/documents/issuer-settings.js';
import { Invoices, InvoicesLive } from '../src/invoices/invoices.js';
import { Quotes, type QuotesService } from '../src/quotes/quotes.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const clientId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const revisionId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';
const lineId = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
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

describe('invoice issue recovery', () => {
  it('reuses the issued revision and number after PDF rendering fails', async () => {
    let renderAttempts = 0;
    const pdf = new TextEncoder().encode('%PDF-1.7\nrecovered');
    const renderer: DocumentRendererService = {
      renderQuote: () => Effect.succeed(''),
      renderQuotePdf: () => Effect.succeed(pdf),
      renderInvoice: () => Effect.succeed(''),
      renderInvoicePdf: () => {
        renderAttempts += 1;
        return renderAttempts === 1
          ? Effect.fail(new DocumentRenderError({ cause: new Error('renderer unavailable') }))
          : Effect.succeed(pdf);
      },
    };
    const issuerSettings: IssuerSettingsService = {
      get: Effect.succeed(issuer),
      update: () => Effect.succeed(issuer),
    };
    const unused = () => Effect.die('The recovery test does not use quote operations.');
    const quotes: QuotesService = {
      list: unused(),
      get: unused,
      getSnapshot: unused,
      create: unused,
      createRevision: unused,
    };
    const databaseLayer = makeDatabaseLayer({
      filename: ':memory:',
      migrationsFolder: join(import.meta.dirname, '..', 'drizzle'),
    });
    const coreLayer = Layer.mergeAll(
      InvoicesLive,
      Layer.succeed(DocumentRenderer, renderer),
      Layer.succeed(Quotes, quotes),
    ).pipe(Layer.provideMerge(Layer.succeed(IssuerSettings, issuerSettings)));
    const testLayer = DocumentArtifactsLive.pipe(
      Layer.provideMerge(coreLayer),
      Layer.provide(AuditLive),
      Layer.provideMerge(databaseLayer),
    );

    const state = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const invoices = yield* Invoices;
        const artifacts = yield* DocumentArtifacts;
        database.sqlite.pragma('foreign_keys = OFF');
        database.sqlite
          .prepare(
            `insert into users (id, display_name, kind, created_at, updated_at)
             values (?, 'Administrator', 'administrator', 1, 1)`,
          )
          .run(actorId);
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
             values (?, ?, 1, null, null, 'Client', 'Invoice', '2026-08-20', '2099-09-19',
                     'Payment due within 30 days.', 'EUR', 10000, 2000, 12000, 1, ?,
                     'invoice-default', 1, ?)`,
          )
          .run(revisionId, invoiceId, actorId, JSON.stringify(snapshot));
        database.sqlite
          .prepare(
            `insert into invoice_lines
             (id, revision_id, position, description, quantity_milli, unit_price_cents,
              vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
             values (?, ?, 0, 'Service', 1000, 10000, 2000, 10000, 2000, 12000)`,
          )
          .run(lineId, revisionId);
        database.sqlite.pragma('foreign_keys = ON');

        const firstIssue = yield* invoices.issue(invoiceId, { expectedVersion: 1 }, actorId);
        const renderFailure = yield* Effect.flip(
          artifacts.renderInvoicePdf(invoiceId, firstIssue.version, actorId),
        );
        const secondIssue = yield* invoices.issue(invoiceId, { expectedVersion: 1 }, actorId);
        const finalVersionRetry = yield* invoices.issue(invoiceId, { expectedVersion: 2 }, actorId);
        const artifact = yield* artifacts.renderInvoicePdf(invoiceId, secondIssue.version, actorId);
        const content = yield* artifacts.getInvoicePdf(invoiceId, secondIssue.version);
        return {
          firstIssue,
          secondIssue,
          finalVersionRetry,
          renderFailure,
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
            .prepare('select next_value from invoice_number_counter where id = 1')
            .pluck()
            .get(),
        };
      }).pipe(Effect.provide(testLayer), Effect.scoped),
    );

    expect(state.renderFailure).toBeInstanceOf(DocumentRenderError);
    expect(state.secondIssue).toEqual(state.firstIssue);
    expect(state.finalVersionRetry).toEqual(state.firstIssue);
    expect(state.invoice).toEqual({ status: 'issued', version: 2, invoiceNumber: 'F-000001' });
    expect(state.revisionCount).toBe(2);
    expect(state.nextNumber).toBe(2);
    expect(state.artifact).toMatchObject({ invoiceRevisionId: state.firstIssue.revisionId });
    expect(Buffer.from(state.content)).toEqual(Buffer.from(pdf));
    expect(renderAttempts).toBe(2);
  });
});
