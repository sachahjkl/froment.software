import {
  DocumentArtifact as DocumentArtifactSchema,
  DocumentNotFound,
  InvoiceDocumentArtifact as InvoiceDocumentArtifactSchema,
  InvoiceNotFound,
  Ulid,
  type DocumentArtifactValue,
  type InvoiceDocumentArtifactValue,
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

type QuoteArtifactError =
  | QuoteNotFound
  | QuotePreviewUnavailable
  | DocumentRenderError
  | DatabaseError;
type InvoiceArtifactError = InvoiceNotFound | DocumentRenderError | DatabaseError;

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
        catch: (cause) => new DatabaseError({ operation: 'find quote PDF', cause }),
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
              if (artifact === undefined) throw new Error('Rendered quote PDF is missing.');
              return artifact;
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'store quote PDF', cause }),
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
        catch: (cause) => new DatabaseError({ operation: 'find invoice PDF', cause }),
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
              if (artifact === undefined) throw new Error('Rendered invoice PDF is missing.');
              return artifact;
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'store invoice PDF', cause }),
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
            : new DatabaseError({ operation: 'get quote PDF', cause }),
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
            : new DatabaseError({ operation: 'get invoice PDF', cause }),
      });
    });

    return DocumentArtifacts.of({
      renderQuotePdf,
      getQuotePdf,
      renderInvoicePdf,
      getInvoicePdf,
    });
  }),
);
