import {
  PublicQuoteConsultation,
  QuoteAcceptanceResult,
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  QuoteNotEditable,
  QuoteNotFound,
  QuotePdfRequired,
  QuoteRenderSnapshot,
  QuoteVersionConflict,
  Ulid,
  type PublicQuoteConsultationValue,
  type PublicQuoteSignatureRequestValue,
  type QuoteAcceptanceResultValue,
  type QuoteLinkTokenValue,
  type QuoteSendRequestValue,
  type QuoteSendResultValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { createHash, randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { Database, DatabaseError } from '../database/database.js';
import { expireSentQuotes } from './quote-expiration.js';

const linkLifetimeMillis = 30 * 24 * 60 * 60 * 1_000;

const QuoteSendRecord = Schema.Struct({
  status: Schema.Literals(['draft', 'sent', 'accepted', 'rejected', 'expired']),
  version: Schema.Int,
  revisionId: Ulid,
  artifactId: Schema.NullOr(Ulid),
});

const PublicQuoteRecord = Schema.Struct({
  quoteId: Ulid,
  status: Schema.Literals(['sent', 'accepted']),
  version: Schema.Int,
  expiresAt: Schema.Int,
  consumedAt: Schema.NullOr(Schema.Int),
  renderSnapshot: Schema.String,
  content: Schema.Uint8Array,
  pdfSha256: Schema.String,
});

const AcceptanceRecord = Schema.Struct({
  linkId: Ulid,
  revisionId: Ulid,
  quoteId: Ulid,
  clientId: Ulid,
  status: Schema.Literals(['draft', 'sent', 'accepted', 'rejected', 'expired']),
  currentVersion: Schema.Int,
  revisionVersion: Schema.Int,
  createdAt: Schema.Int,
  expiresAt: Schema.Int,
  revokedAt: Schema.NullOr(Schema.Int),
  consumedAt: Schema.NullOr(Schema.Int),
  renderSnapshot: Schema.String,
  content: Schema.Uint8Array,
  pdfSha256: Schema.String,
});

export interface PublicQuotePdf {
  readonly quoteId: UlidValue;
  readonly version: number;
  readonly content: Uint8Array;
}

export interface PublicQuoteContext {
  readonly ipAddress: string;
  readonly userAgent: string;
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
  readonly get: (
    token: QuoteLinkTokenValue,
  ) => Effect.Effect<PublicQuoteConsultationValue, QuoteLinkNotFound | DatabaseError>;
  readonly accept: (
    request: PublicQuoteSignatureRequestValue,
    context: PublicQuoteContext,
  ) => Effect.Effect<
    QuoteAcceptanceResultValue,
    QuoteLinkNotFound | QuoteLinkNotSignable | DatabaseError
  >;
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
              expireSentQuotes(database.sqlite, audit, now, quoteId);
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
                  url: `${config.publicOrigin}/quote#${token}`,
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

    const findPublicQuote = (token: QuoteLinkTokenValue, now: number) => {
      const raw = database.sqlite
        .prepare(
          `select quotes.id as quoteId, quotes.status, quote_revisions.version,
                  quote_links.expires_at as expiresAt, quote_links.consumed_at as consumedAt,
                  quote_revisions.render_snapshot as renderSnapshot,
                  document_artifacts.content, document_artifacts.sha256 as pdfSha256
           from quote_links
           join quote_revisions on quote_revisions.id = quote_links.revision_id
            join quotes on quotes.id = quote_revisions.quote_id
            join users on users.id = quotes.client_id
           join document_artifacts
             on document_artifacts.revision_id = quote_revisions.id
            and document_artifacts.kind = 'quote-pdf'
           where quote_links.token_hmac = ?
             and quote_links.revoked_at is null
              and quote_links.expires_at > ?
              and users.disabled_at is null
              and quotes.status in ('sent', 'accepted')`,
        )
        .get(hmac(config.quoteLinkHmacKey, token), now);
      if (raw === undefined) throw new QuoteLinkNotFound({ code: 'quote_link.not_found' });
      return Schema.decodeUnknownSync(PublicQuoteRecord)(raw);
    };

    const get = Effect.fn('QuoteLinks.get')(function* (token: QuoteLinkTokenValue) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              expireSentQuotes(database.sqlite, audit, now);
              const quote = findPublicQuote(token, now);
              return PublicQuoteConsultation.make({
                status: quote.status,
                canSign: quote.status === 'sent' && quote.consumedAt === null,
                expiresAt: DateTime.formatIso(DateTime.makeUnsafe(quote.expiresAt)),
                snapshot: Schema.decodeUnknownSync(QuoteRenderSnapshot)(
                  JSON.parse(quote.renderSnapshot),
                ),
              });
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof QuoteLinkNotFound
            ? cause
            : new DatabaseError({ operation: 'get public quote', cause }),
      });
    });

    const getPdf = Effect.fn('QuoteLinks.getPdf')(function* (token: QuoteLinkTokenValue) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              expireSentQuotes(database.sqlite, audit, now);
              const quote = findPublicQuote(token, now);
              return { quoteId: quote.quoteId, version: quote.version, content: quote.content };
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof QuoteLinkNotFound
            ? cause
            : new DatabaseError({ operation: 'get public quote PDF', cause }),
      });
    });

    const accept = Effect.fn('QuoteLinks.accept')(function* (
      request: PublicQuoteSignatureRequestValue,
      context: PublicQuoteContext,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              expireSentQuotes(database.sqlite, audit, now);
              const raw = database.sqlite
                .prepare(
                  `select quote_links.id as linkId, quote_links.revision_id as revisionId,
                          quote_links.created_at as createdAt, quote_links.expires_at as expiresAt,
                          quote_links.revoked_at as revokedAt,
                          quote_links.consumed_at as consumedAt,
                          quotes.id as quoteId, quotes.client_id as clientId, quotes.status,
                          quotes.version as currentVersion, quote_revisions.version as revisionVersion,
                          quote_revisions.render_snapshot as renderSnapshot,
                          document_artifacts.content, document_artifacts.sha256 as pdfSha256
                   from quote_links
                   join quote_revisions on quote_revisions.id = quote_links.revision_id
                    join quotes on quotes.id = quote_revisions.quote_id
                    join users on users.id = quotes.client_id
                   join document_artifacts
                     on document_artifacts.revision_id = quote_revisions.id
                    and document_artifacts.kind = 'quote-pdf'
                    where quote_links.token_hmac = ? and users.disabled_at is null`,
                )
                .get(hmac(config.quoteLinkHmacKey, request.token));
              if (raw === undefined) {
                throw new QuoteLinkNotFound({ code: 'quote_link.not_found' });
              }
              const quote = Schema.decodeUnknownSync(AcceptanceRecord)(raw);
              if (quote.revokedAt !== null || quote.expiresAt <= now) {
                throw new QuoteLinkNotFound({ code: 'quote_link.not_found' });
              }
              if (
                quote.consumedAt !== null ||
                quote.status !== 'sent' ||
                quote.currentVersion !== quote.revisionVersion
              ) {
                throw new QuoteLinkNotSignable({ code: 'quote_link.not_signable' });
              }

              const snapshot = Schema.decodeUnknownSync(QuoteRenderSnapshot)(
                JSON.parse(quote.renderSnapshot),
              );
              const snapshotSha256 = createHash('sha256')
                .update(quote.renderSnapshot)
                .digest('hex');
              const pdfSha256 = createHash('sha256').update(quote.content).digest('hex');
              if (pdfSha256 !== quote.pdfSha256) {
                throw new Error('The stored quote PDF digest does not match its content.');
              }

              const signatureId = ulid(now);
              const orderId = ulid(now + 1);
              const auditEventId = audit.insert({
                action: 'quote.accepted',
                actorUserId: null,
                resourceType: 'quote',
                resourceId: quote.quoteId,
                metadata: {
                  linkId: quote.linkId,
                  orderId,
                  revisionId: quote.revisionId,
                  signatureId,
                },
                occurredAt: now,
              });
              const acceptedAt = DateTime.formatIso(DateTime.makeUnsafe(now));
              const evidenceContent = Buffer.from(
                JSON.stringify({
                  version: 1,
                  quoteId: quote.quoteId,
                  revisionId: quote.revisionId,
                  linkId: quote.linkId,
                  signatureId,
                  orderId,
                  auditEventId,
                  snapshot,
                  snapshotSha256,
                  pdfSha256,
                  signerName: request.signerName,
                  consent: request.consent,
                  signature: request.signature,
                  acceptedAt,
                  ipAddress: context.ipAddress,
                  userAgent: context.userAgent,
                }),
              );
              const evidenceSha256 = createHash('sha256').update(evidenceContent).digest('hex');

              const consumed = database.sqlite
                .prepare(
                  `update quote_links set consumed_at = ?
                   where id = ? and consumed_at is null and revoked_at is null and expires_at > ?`,
                )
                .run(now, quote.linkId, now).changes;
              const accepted = database.sqlite
                .prepare(
                  `update quotes set status = 'accepted', updated_at = ?
                   where id = ? and status = 'sent' and version = ?`,
                )
                .run(now, quote.quoteId, quote.revisionVersion).changes;
              if (consumed !== 1 || accepted !== 1) {
                throw new QuoteLinkNotSignable({ code: 'quote_link.not_signable' });
              }

              database.sqlite
                .prepare(
                  `insert into quote_signatures
                   (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind,
                    signature_value, signed_at, ip_address, user_agent, snapshot_sha256,
                    pdf_sha256, audit_event_id, evidence_content, evidence_sha256)
                   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                  signatureId,
                  quote.quoteId,
                  quote.revisionId,
                  quote.linkId,
                  request.signerName,
                  request.consent ? 1 : 0,
                  request.signature.kind,
                  request.signature.value,
                  now,
                  context.ipAddress,
                  context.userAgent,
                  snapshotSha256,
                  pdfSha256,
                  auditEventId,
                  evidenceContent,
                  evidenceSha256,
                );
              database.sqlite
                .prepare(
                  `insert into orders
                   (id, quote_id, revision_id, client_id, signature_id, status, created_at)
                   values (?, ?, ?, ?, ?, 'confirmed', ?)`,
                )
                .run(orderId, quote.quoteId, quote.revisionId, quote.clientId, signatureId, now);

              return QuoteAcceptanceResult.make({
                quoteId: quote.quoteId,
                revisionId: quote.revisionId,
                signatureId,
                orderId,
                status: 'accepted',
                acceptedAt,
                evidenceSha256,
              });
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof QuoteLinkNotFound || cause instanceof QuoteLinkNotSignable) {
            return cause;
          }
          return new DatabaseError({ operation: 'accept quote', cause });
        },
      });
    });

    return QuoteLinks.of({ send, get, getPdf, accept });
  }),
);
