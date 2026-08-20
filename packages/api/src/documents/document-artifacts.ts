import {
  DocumentArtifact as DocumentArtifactSchema,
  DocumentNotFound,
  Ulid,
  type DocumentArtifactValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

import { Database, DatabaseError } from '../database/database.js';
import { QuotePreviewUnavailable, QuoteNotFound } from '@froment/contracts';
import { Quotes } from '../quotes/quotes.js';
import { DocumentRenderError, QuoteRenderer } from './quote-renderer.js';

const ArtifactRecord = Schema.Struct({
  id: Ulid,
  revisionId: Ulid,
  kind: Schema.Literal('quote-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: Schema.Int,
  sha256: Schema.String,
  createdAt: Schema.Int,
});
const ArtifactContentRecord = Schema.Struct({ content: Schema.Uint8Array });

type ArtifactError = QuoteNotFound | QuotePreviewUnavailable | DocumentRenderError | DatabaseError;

export interface DocumentArtifactsService {
  readonly renderQuotePdf: (
    quoteId: UlidValue,
    version: number,
  ) => Effect.Effect<DocumentArtifactValue, ArtifactError>;
  readonly getQuotePdf: (
    quoteId: UlidValue,
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
    const renderer = yield* QuoteRenderer;

    const readMetadata = (quoteId: string, version: number): DocumentArtifactValue | undefined => {
      const row = database.sqlite
        .prepare(
          `select document_artifacts.id, document_artifacts.revision_id as revisionId,
                  document_artifacts.kind, document_artifacts.content_type as contentType,
                  document_artifacts.byte_size as byteSize, document_artifacts.sha256,
                  document_artifacts.created_at as createdAt
           from document_artifacts
           join quote_revisions on quote_revisions.id = document_artifacts.revision_id
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
    ) {
      const existing = yield* Effect.try({
        try: () => readMetadata(quoteId, version),
        catch: (cause) => new DatabaseError({ operation: 'find quote PDF', cause }),
      });
      if (existing !== undefined) return existing;

      const snapshot = yield* quotes.getSnapshot(quoteId, version);
      const pdf = yield* renderer.renderPdf(snapshot);
      const now = yield* Clock.currentTimeMillis;
      const artifactId = ulid(now);
      const sha256 = createHash('sha256').update(pdf).digest('hex');
      return yield* Effect.try({
        try: () => {
          database.sqlite
            .prepare(
              `insert or ignore into document_artifacts
               (id, revision_id, kind, content_type, byte_size, sha256, content, created_at)
               values (?, ?, 'quote-pdf', 'application/pdf', ?, ?, ?, ?)`,
            )
            .run(artifactId, snapshot.revisionId, pdf.byteLength, sha256, Buffer.from(pdf), now);
          const artifact = readMetadata(quoteId, version);
          if (artifact === undefined) throw new Error('Rendered quote PDF is missing.');
          return artifact;
        },
        catch: (cause) => new DatabaseError({ operation: 'store quote PDF', cause }),
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
              `select document_artifacts.content
               from document_artifacts
               join quote_revisions on quote_revisions.id = document_artifacts.revision_id
               where quote_revisions.quote_id = ? and quote_revisions.version = ?
                 and document_artifacts.kind = 'quote-pdf'`,
            )
            .get(quoteId, version);
          if (row === undefined) throw new DocumentNotFound({ code: 'document.not_found' });
          return Schema.decodeUnknownSync(ArtifactContentRecord)(row).content;
        },
        catch: (cause) =>
          cause instanceof DocumentNotFound
            ? cause
            : new DatabaseError({ operation: 'get quote PDF', cause }),
      });
    });

    return DocumentArtifacts.of({ renderQuotePdf, getQuotePdf });
  }),
);
