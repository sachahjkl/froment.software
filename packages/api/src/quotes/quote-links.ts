import {
  QuoteLinkNotFound,
  QuoteNotEditable,
  QuoteNotFound,
  QuotePdfRequired,
  QuoteVersionConflict,
  Ulid,
  type QuoteLinkTokenValue,
  type QuoteSendRequestValue,
  type QuoteSendResultValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { Database, DatabaseError } from '../database/database.js';

const linkLifetimeMillis = 30 * 24 * 60 * 60 * 1_000;

const QuoteSendRecord = Schema.Struct({
  status: Schema.Literals(['draft', 'sent', 'accepted', 'rejected', 'expired']),
  version: Schema.Int,
  revisionId: Ulid,
  artifactId: Schema.NullOr(Ulid),
});

const PublicPdfRecord = Schema.Struct({
  quoteId: Ulid,
  version: Schema.Int,
  content: Schema.Uint8Array,
});

export interface PublicQuotePdf {
  readonly quoteId: UlidValue;
  readonly version: number;
  readonly content: Uint8Array;
}

type QuoteSendError =
  | QuoteNotFound
  | QuoteNotEditable
  | QuoteVersionConflict
  | QuotePdfRequired
  | DatabaseError;

export interface QuoteLinksService {
  readonly send: (
    quoteId: UlidValue,
    request: QuoteSendRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<QuoteSendResultValue, QuoteSendError>;
  readonly getPdf: (
    token: QuoteLinkTokenValue,
  ) => Effect.Effect<PublicQuotePdf, QuoteLinkNotFound | DatabaseError>;
}

export class QuoteLinks extends Context.Service<QuoteLinks, QuoteLinksService>()(
  '@froment/api/QuoteLinks',
) {}

export const QuoteLinksLive = Layer.effect(
  QuoteLinks,
  Effect.gen(function* () {
    const audit = yield* Audit;
    const config = yield* AuthenticationConfig;
    const database = yield* Database;

    const send = Effect.fn('QuoteLinks.send')(function* (
      quoteId: UlidValue,
      request: QuoteSendRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const expiresAt = now + linkLifetimeMillis;
      const linkId = ulid(now);
      const token = randomBytes(32).toString('base64url');

      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const raw = database.sqlite
                .prepare(
                  `select quotes.status, quotes.version, quote_revisions.id as revisionId,
                          document_artifacts.id as artifactId
                   from quotes
                   join quote_revisions
                     on quote_revisions.quote_id = quotes.id
                    and quote_revisions.version = quotes.version
                   left join document_artifacts
                     on document_artifacts.revision_id = quote_revisions.id
                    and document_artifacts.kind = 'quote-pdf'
                   where quotes.id = ?`,
                )
                .get(quoteId);
              if (raw === undefined) throw new QuoteNotFound({ code: 'quote.not_found' });
              const quote = Schema.decodeUnknownSync(QuoteSendRecord)(raw);
              if (quote.status !== 'draft') {
                throw new QuoteNotEditable({ code: 'quote.not_editable' });
              }
              if (quote.version !== request.expectedVersion) {
                throw new QuoteVersionConflict({
                  code: 'quote.version_conflict',
                  currentVersion: quote.version,
                });
              }
              if (quote.artifactId === null) {
                throw new QuotePdfRequired({ code: 'quote.pdf_required' });
              }

              database.sqlite
                .prepare(
                  `insert into quote_links
                   (id, revision_id, token_hmac, created_at, expires_at)
                   values (?, ?, ?, ?, ?)`,
                )
                .run(
                  linkId,
                  quote.revisionId,
                  hmac(config.quoteLinkHmacKey, token),
                  now,
                  expiresAt,
                );

              const updated = database.sqlite
                .prepare(
                  `update quotes set status = 'sent', updated_at = ?
                   where id = ? and status = 'draft' and version = ?`,
                )
                .run(now, quoteId, request.expectedVersion).changes;
              if (updated !== 1) throw new QuoteNotEditable({ code: 'quote.not_editable' });

              audit.insert({
                action: 'quote.sent',
                actorUserId,
                resourceType: 'quote',
                resourceId: quoteId,
                metadata: {
                  artifactId: quote.artifactId,
                  linkId,
                  revisionId: quote.revisionId,
                  version: String(quote.version),
                },
                occurredAt: now,
              });

              return {
                quoteId,
                revisionId: quote.revisionId,
                status: 'sent' as const,
                version: quote.version,
                link: {
                  id: linkId,
                  url: `${config.publicOrigin}/api/public/quote-links/${token}/pdf`,
                  expiresAt: DateTime.formatIso(DateTime.makeUnsafe(expiresAt)),
                },
              };
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof QuoteNotFound ||
            cause instanceof QuoteNotEditable ||
            cause instanceof QuoteVersionConflict ||
            cause instanceof QuotePdfRequired
          ) {
            return cause;
          }
          return new DatabaseError({ operation: 'send quote', cause });
        },
      });
    });

    const getPdf = Effect.fn('QuoteLinks.getPdf')(function* (token: QuoteLinkTokenValue) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () => {
          const raw = database.sqlite
            .prepare(
              `select quotes.id as quoteId, quote_revisions.version, document_artifacts.content
               from quote_links
               join quote_revisions on quote_revisions.id = quote_links.revision_id
               join quotes on quotes.id = quote_revisions.quote_id
               join document_artifacts
                 on document_artifacts.revision_id = quote_revisions.id
                and document_artifacts.kind = 'quote-pdf'
               where quote_links.token_hmac = ?
                 and quote_links.revoked_at is null
                 and quote_links.expires_at > ?`,
            )
            .get(hmac(config.quoteLinkHmacKey, token), now);
          if (raw === undefined) {
            throw new QuoteLinkNotFound({ code: 'quote_link.not_found' });
          }
          return Schema.decodeUnknownSync(PublicPdfRecord)(raw);
        },
        catch: (cause) =>
          cause instanceof QuoteLinkNotFound
            ? cause
            : new DatabaseError({ operation: 'get public quote PDF', cause }),
      });
    });

    return QuoteLinks.of({ send, getPdf });
  }),
);
