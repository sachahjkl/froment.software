import {
  DocumentArtifact as DocumentArtifactSchema,
  DocumentNotFound,
  InvoiceDocumentArtifact as InvoiceDocumentArtifactSchema,
  InvoiceNotFound,
  OrderDocumentArtifact as OrderDocumentArtifactSchema,
  OrderNotFound,
  Ulid,
  type DocumentArtifactValue,
  type InvoiceDocumentArtifactValue,
  type OrderDocumentArtifactValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { QuotePreviewUnavailable, QuoteNotFound } from '@froment/contracts';
import { Quotes } from '../quotes/quotes.js';
import { Invoices } from '../invoices/invoices.js';
import { Orders } from '../orders/orders.js';
import { verifyArtifactContent } from './artifact-integrity.js';
import { DocumentRenderer, DocumentRenderError } from './document-renderer.js';

const ArtifactRecord = Schema.Struct({
  id: Ulid,
  quoteReference: Schema.String,
  revisionId: Ulid,
  kind: Schema.Literal('quote-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: Schema.Int,
  sha256: Schema.String,
  createdAt: Schema.Int,
});
const ArtifactContentRecord = Schema.Struct({ content: Schema.Uint8Array, sha256: Schema.String });
const InvoiceArtifactRecord = Schema.Struct({
  id: Ulid,
  invoiceNumber: Schema.String,
  invoiceRevisionId: Ulid,
  kind: Schema.Literal('invoice-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: Schema.Int,
  sha256: Schema.String,
  createdAt: Schema.Int,
});
const OrderArtifactRecord = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  orderReference: Schema.String,
  kind: Schema.Literal('order-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: Schema.Int,
  sha256: Schema.String,
  createdAt: Schema.Int,
});
const OrderPdfRecord = Schema.Struct({
  content: Schema.Uint8Array,
  sha256: Schema.String,
  reference: Schema.String,
});

export interface StoredOrderPdf {
  readonly content: Uint8Array;
  readonly reference: string;
}

type QuoteArtifactError =
  | QuoteNotFound
  | QuotePreviewUnavailable
  | DocumentRenderError
  | DatabaseError;
type InvoiceArtifactError = InvoiceNotFound | DocumentRenderError | DatabaseError;
type OrderArtifactError =
  | OrderNotFound
  | QuotePreviewUnavailable
  | DocumentRenderError
  | DatabaseError;

export interface DocumentArtifactsService {
  readonly renderQuotePdf: (
    quoteId: UlidValue,
    version: number,
    actorUserId: UlidValue,
  ) => Effect.Effect<DocumentArtifactValue, QuoteArtifactError>;
  readonly getQuotePdf: (
    quoteId: UlidValue,
    version: number,
  ) => Effect.Effect<Uint8Array, DocumentNotFound | DatabaseError>;
  readonly renderInvoicePdf: (
    invoiceId: UlidValue,
    version: number,
    actorUserId: UlidValue,
  ) => Effect.Effect<InvoiceDocumentArtifactValue, InvoiceArtifactError>;
  readonly getInvoicePdf: (
    invoiceId: UlidValue,
    version: number,
  ) => Effect.Effect<Uint8Array, DocumentNotFound | DatabaseError>;
  readonly renderOrderPdf: (
    orderId: UlidValue,
    actorUserId: UlidValue | null,
  ) => Effect.Effect<OrderDocumentArtifactValue, OrderArtifactError>;
  readonly getOrderPdf: (
    orderId: UlidValue,
  ) => Effect.Effect<StoredOrderPdf, DocumentNotFound | DatabaseError>;
}

export class DocumentArtifacts extends Context.Service<
  DocumentArtifacts,
  DocumentArtifactsService
>()('@froment/api/DocumentArtifacts') {}

export const DocumentArtifactsLive = Layer.effect(
  DocumentArtifacts,
  Effect.gen(function* () {
    const database = yield* Database;
    const quotes = yield* Quotes;
    const invoices = yield* Invoices;
    const orders = yield* Orders;
    const renderer = yield* DocumentRenderer;
    const audit = yield* Audit;

    const readMetadata = (quoteId: string, version: number): DocumentArtifactValue | undefined => {
      const row = database.sqlite
        .prepare(
          `select document_artifacts.id, quotes.reference as quoteReference,
                   document_artifacts.revision_id as revisionId,
                  document_artifacts.kind, document_artifacts.content_type as contentType,
                  document_artifacts.byte_size as byteSize, document_artifacts.sha256,
                  document_artifacts.created_at as createdAt
           from document_artifacts
            join quote_revisions on quote_revisions.id = document_artifacts.revision_id
            join quotes on quotes.id = quote_revisions.quote_id
           where quote_revisions.quote_id = ? and quote_revisions.version = ?
             and document_artifacts.kind = 'quote-pdf'`,
        )
        .get(quoteId, version);
      if (row === undefined) return undefined;
      const artifact = Schema.decodeUnknownSync(ArtifactRecord)(row);
      return Schema.decodeUnknownSync(DocumentArtifactSchema)({
        ...artifact,
        createdAt: DateTime.formatIso(DateTime.makeUnsafe(artifact.createdAt)),
      });
    };

    const renderQuotePdf = Effect.fn('DocumentArtifacts.renderQuotePdf')(function* (
      quoteId: UlidValue,
      version: number,
      actorUserId: UlidValue,
    ) {
      const existing = yield* Effect.try({
        try: () => readMetadata(quoteId, version),
        catch: (cause) => new DatabaseError({ operation: 'find.quote.pdf', cause }),
      });
      if (existing !== undefined) return existing;

      const snapshot = yield* quotes.getSnapshot(quoteId, version);
      const pdf = yield* renderer.renderQuotePdf(snapshot);
      const now = yield* Clock.currentTimeMillis;
      const artifactId = ulid(now);
      const sha256 = createHash('sha256').update(pdf).digest('hex');
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const inserted = database.sqlite
                .prepare(
                  `insert or ignore into document_artifacts
                   (id, revision_id, kind, content_type, byte_size, sha256, content, created_at)
                   values (?, ?, 'quote-pdf', 'application/pdf', ?, ?, ?, ?)`,
                )
                .run(
                  artifactId,
                  snapshot.revisionId,
                  pdf.byteLength,
                  sha256,
                  Buffer.from(pdf),
                  now,
                ).changes;
              if (inserted === 1) {
                audit.insert({
                  action: 'document.rendered',
                  actorUserId,
                  resourceType: 'document',
                  resourceId: artifactId,
                  metadata: { kind: 'quote-pdf', quoteId, version: String(version) },
                  occurredAt: now,
                });
              }
              const artifact = readMetadata(quoteId, version);
              if (artifact === undefined) throw new Error('quote.pdf.rendered.missing');
              return artifact;
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'store.quote.pdf', cause }),
      });
    });

    const readInvoiceMetadata = (
      invoiceId: string,
      version: number,
    ): InvoiceDocumentArtifactValue | undefined => {
      const row = database.sqlite
        .prepare(
          `select document_artifacts.id, invoice_revisions.invoice_number as invoiceNumber,
                  document_artifacts.invoice_revision_id as invoiceRevisionId,
                  document_artifacts.kind, document_artifacts.content_type as contentType,
                  document_artifacts.byte_size as byteSize, document_artifacts.sha256,
                  document_artifacts.created_at as createdAt
           from document_artifacts
           join invoice_revisions
             on invoice_revisions.id = document_artifacts.invoice_revision_id
           where invoice_revisions.invoice_id = ? and invoice_revisions.version = ?
             and document_artifacts.kind = 'invoice-pdf'`,
        )
        .get(invoiceId, version);
      if (row === undefined) return undefined;
      const artifact = Schema.decodeUnknownSync(InvoiceArtifactRecord)(row);
      return Schema.decodeUnknownSync(InvoiceDocumentArtifactSchema)({
        ...artifact,
        createdAt: DateTime.formatIso(DateTime.makeUnsafe(artifact.createdAt)),
      });
    };

    const renderInvoicePdf = Effect.fn('DocumentArtifacts.renderInvoicePdf')(function* (
      invoiceId: UlidValue,
      version: number,
      actorUserId: UlidValue,
    ) {
      const existing = yield* Effect.try({
        try: () => readInvoiceMetadata(invoiceId, version),
        catch: (cause) => new DatabaseError({ operation: 'find.invoice.pdf', cause }),
      });
      if (existing !== undefined) return existing;

      const snapshot = yield* invoices.getSnapshot(invoiceId, version);
      const pdf = yield* renderer.renderInvoicePdf(snapshot);
      const now = yield* Clock.currentTimeMillis;
      const artifactId = ulid(now);
      const sha256 = createHash('sha256').update(pdf).digest('hex');
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const inserted = database.sqlite
                .prepare(
                  `insert or ignore into document_artifacts
                   (id, invoice_revision_id, kind, content_type, byte_size, sha256, content,
                    created_at)
                   values (?, ?, 'invoice-pdf', 'application/pdf', ?, ?, ?, ?)`,
                )
                .run(
                  artifactId,
                  snapshot.revisionId,
                  pdf.byteLength,
                  sha256,
                  Buffer.from(pdf),
                  now,
                ).changes;
              if (inserted === 1) {
                audit.insert({
                  action: 'document.rendered',
                  actorUserId,
                  resourceType: 'document',
                  resourceId: artifactId,
                  metadata: { kind: 'invoice-pdf', invoiceId, version: String(version) },
                  occurredAt: now,
                });
              }
              const artifact = readInvoiceMetadata(invoiceId, version);
              if (artifact === undefined) throw new Error('invoice.pdf.rendered.missing');
              return artifact;
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'store.invoice.pdf', cause }),
      });
    });

    const getQuotePdf = Effect.fn('DocumentArtifacts.getQuotePdf')(function* (
      quoteId: UlidValue,
      version: number,
    ) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select document_artifacts.content, document_artifacts.sha256
               from document_artifacts
               join quote_revisions on quote_revisions.id = document_artifacts.revision_id
               where quote_revisions.quote_id = ? and quote_revisions.version = ?
                 and document_artifacts.kind = 'quote-pdf'`,
            )
            .get(quoteId, version);
          if (row === undefined) throw new DocumentNotFound({ code: 'document.not_found' });
          return verifyArtifactContent(Schema.decodeUnknownSync(ArtifactContentRecord)(row))
            .content;
        },
        catch: (cause) =>
          cause instanceof DocumentNotFound
            ? cause
            : new DatabaseError({ operation: 'get.quote.pdf', cause }),
      });
    });

    const getInvoicePdf = Effect.fn('DocumentArtifacts.getInvoicePdf')(function* (
      invoiceId: UlidValue,
      version: number,
    ) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select document_artifacts.content, document_artifacts.sha256
               from document_artifacts
               join invoice_revisions
                 on invoice_revisions.id = document_artifacts.invoice_revision_id
               where invoice_revisions.invoice_id = ? and invoice_revisions.version = ?
                 and document_artifacts.kind = 'invoice-pdf'`,
            )
            .get(invoiceId, version);
          if (row === undefined) throw new DocumentNotFound({ code: 'document.not_found' });
          return verifyArtifactContent(Schema.decodeUnknownSync(ArtifactContentRecord)(row))
            .content;
        },
        catch: (cause) =>
          cause instanceof DocumentNotFound
            ? cause
            : new DatabaseError({ operation: 'get.invoice.pdf', cause }),
      });
    });

    const readOrderMetadata = (orderId: string): OrderDocumentArtifactValue | undefined => {
      const row = database.sqlite
        .prepare(
          `select document_artifacts.id, orders.id as orderId,
                  orders.reference as orderReference, document_artifacts.kind,
                  document_artifacts.content_type as contentType,
                  document_artifacts.byte_size as byteSize, document_artifacts.sha256,
                  document_artifacts.created_at as createdAt
           from document_artifacts join orders on orders.id = document_artifacts.order_id
           where orders.id = ? and document_artifacts.kind = 'order-pdf'`,
        )
        .get(orderId);
      if (row === undefined) return undefined;
      const artifact = Schema.decodeUnknownSync(OrderArtifactRecord)(row);
      return Schema.decodeUnknownSync(OrderDocumentArtifactSchema)({
        ...artifact,
        createdAt: DateTime.formatIso(DateTime.makeUnsafe(artifact.createdAt)),
      });
    };

    const renderOrderPdf = Effect.fn('DocumentArtifacts.renderOrderPdf')(function* (
      orderId: UlidValue,
      actorUserId: UlidValue | null,
    ) {
      const existing = yield* Effect.try({
        try: () => readOrderMetadata(orderId),
        catch: (cause) => new DatabaseError({ operation: 'find.order.pdf', cause }),
      });
      if (existing !== undefined) return existing;
      const snapshot = yield* orders.getSnapshot(orderId);
      const pdf = yield* renderer.renderOrderPdf(snapshot);
      const now = yield* Clock.currentTimeMillis;
      const artifactId = ulid(now);
      const sha256 = createHash('sha256').update(pdf).digest('hex');
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const inserted = database.sqlite
                .prepare(
                  `insert or ignore into document_artifacts
                 (id, order_id, kind, content_type, byte_size, sha256, content, created_at)
                 values (?, ?, 'order-pdf', 'application/pdf', ?, ?, ?, ?)`,
                )
                .run(artifactId, orderId, pdf.byteLength, sha256, Buffer.from(pdf), now).changes;
              if (inserted === 1) {
                audit.insert({
                  action: 'document.rendered',
                  actorUserId,
                  resourceType: 'document',
                  resourceId: artifactId,
                  metadata: { kind: 'order-pdf', orderId },
                  occurredAt: now,
                });
              }
              const artifact = readOrderMetadata(orderId);
              if (artifact === undefined) throw new Error('order.pdf.rendered.missing');
              return artifact;
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'store.order.pdf', cause }),
      });
    });

    const getOrderPdf = Effect.fn('DocumentArtifacts.getOrderPdf')(function* (orderId: UlidValue) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select document_artifacts.content, document_artifacts.sha256, orders.reference
               from document_artifacts
               join orders on orders.id = document_artifacts.order_id
               where document_artifacts.order_id = ? and document_artifacts.kind = 'order-pdf'`,
            )
            .get(orderId);
          if (row === undefined) throw new DocumentNotFound({ code: 'document.not_found' });
          return verifyArtifactContent(Schema.decodeUnknownSync(OrderPdfRecord)(row));
        },
        catch: (cause) =>
          cause instanceof DocumentNotFound
            ? cause
            : new DatabaseError({ operation: 'get.order.pdf', cause }),
      });
    });

    return DocumentArtifacts.of({
      renderQuotePdf,
      getQuotePdf,
      renderInvoicePdf,
      getInvoicePdf,
      renderOrderPdf,
      getOrderPdf,
    });
  }),
);
