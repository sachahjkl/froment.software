import {
  ClientArchived,
  ClientNotFound,
  QuoteAmountTooLarge,
  QuoteNotFound,
  QuoteNotEditable,
  QuotePreviewUnavailable,
  QuoteRenderSnapshot,
  QuoteStatus,
  QuoteVersionConflict,
  Ulid,
  type QuoteCreateRequestValue,
  type QuoteDetailValue,
  type QuoteLineInputValue,
  type QuoteLineValue,
  type QuoteListValue,
  type QuoteRevisionCreateRequestValue,
  type QuoteRevisionValue,
  type QuoteRenderSnapshotValue,
  type IssuerSettingsValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { IssuerSettings } from '../documents/issuer-settings.js';
import { calculateQuoteLine, calculateQuoteTotals } from './quote-calculation.js';
import { expireSentQuotes } from './quote-expiration.js';

const QuoteRecord = Schema.Struct({
  id: Ulid,
  clientId: Ulid,
  status: QuoteStatus,
  version: Schema.Int,
});
const RevisionRecord = Schema.Struct({
  id: Ulid,
  quoteId: Ulid,
  version: Schema.Int,
  clientDisplayName: Schema.NonEmptyString,
  title: Schema.String,
  conditions: Schema.String,
  currency: Schema.Literal('EUR'),
  netTotalCents: Schema.Int,
  vatTotalCents: Schema.Int,
  totalCents: Schema.Int,
  createdAt: Schema.Int,
  createdByUserId: Ulid,
  previewAvailable: Schema.Int,
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
const ClientRecord = Schema.Struct({
  displayName: Schema.NonEmptyString,
  addressLine1: Schema.String,
  addressLine2: Schema.String,
  postalCode: Schema.String,
  city: Schema.String,
  country: Schema.String,
  email: Schema.String,
  disabledAt: Schema.NullOr(Schema.Number),
});
const SnapshotRecord = Schema.Struct({ renderSnapshot: Schema.NullOr(Schema.String) });
const QuoteSummaryRecord = Schema.Struct({
  id: Ulid,
  clientId: Ulid,
  clientDisplayName: Schema.NonEmptyString,
  status: QuoteStatus,
  version: Schema.Int,
  title: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  updatedAt: Schema.Int,
});

type QuoteError =
  | QuoteNotFound
  | QuoteNotEditable
  | QuoteVersionConflict
  | ClientNotFound
  | ClientArchived
  | QuoteAmountTooLarge
  | DatabaseError;

export interface QuotesService {
  readonly list: Effect.Effect<QuoteListValue, DatabaseError>;
  readonly get: (
    quoteId: UlidValue,
  ) => Effect.Effect<QuoteDetailValue, QuoteNotFound | DatabaseError>;
  readonly getSnapshot: (
    quoteId: UlidValue,
    version: number,
  ) => Effect.Effect<
    QuoteRenderSnapshotValue,
    QuoteNotFound | QuotePreviewUnavailable | DatabaseError
  >;
  readonly create: (
    request: QuoteCreateRequestValue,
    createdByUserId: string,
  ) => Effect.Effect<
    QuoteDetailValue,
    ClientNotFound | ClientArchived | QuoteAmountTooLarge | DatabaseError
  >;
  readonly createRevision: (
    quoteId: UlidValue,
    request: QuoteRevisionCreateRequestValue,
    createdByUserId: string,
  ) => Effect.Effect<QuoteDetailValue, QuoteError>;
}

export class Quotes extends Context.Service<Quotes, QuotesService>()('@froment/api/Quotes') {}

const quoteSql = `select id, client_id as clientId, status, version from quotes`;
const revisionSql = `select id, quote_id as quoteId, version,
  client_display_name as clientDisplayName, title, conditions, currency,
  net_total_cents as netTotalCents, vat_total_cents as vatTotalCents,
  total_cents as totalCents, created_at as createdAt, created_by_user_id as createdByUserId,
  render_snapshot is not null as previewAvailable
  from quote_revisions`;
const lineSql = `select id, revision_id as revisionId, position, description,
  quantity_milli as quantityMilli, unit_price_cents as unitPriceCents,
  vat_rate_basis_points as vatRateBasisPoints, net_total_cents as netTotalCents,
  vat_total_cents as vatTotalCents, total_cents as totalCents from quote_lines`;

export const QuotesLive = Layer.effect(
  Quotes,
  Effect.gen(function* () {
    const database = yield* Database;
    const issuerSettings = yield* IssuerSettings;
    const audit = yield* Audit;

    const readDetail = (quoteId: string): QuoteDetailValue | undefined => {
      const rawQuote = database.sqlite.prepare(`${quoteSql} where id = ?`).get(quoteId);
      if (rawQuote === undefined) return undefined;
      const quote = Schema.decodeUnknownSync(QuoteRecord)(rawQuote);
      const revisions = Schema.decodeUnknownSync(Schema.Array(RevisionRecord))(
        database.sqlite.prepare(`${revisionSql} where quote_id = ? order by version`).all(quoteId),
      );
      const revisionIds = revisions.map((revision) => revision.id);
      const lines =
        revisionIds.length === 0
          ? []
          : Schema.decodeUnknownSync(Schema.Array(LineRecord))(
              database.sqlite
                .prepare(
                  `${lineSql} where revision_id in (${revisionIds.map(() => '?').join(', ')}) order by revision_id, position`,
                )
                .all(...revisionIds),
            );
      const mappedRevisions: Array<QuoteRevisionValue> = revisions.map((revision) => ({
        id: revision.id,
        version: revision.version,
        previewAvailable: revision.previewAvailable === 1,
        clientDisplayName: revision.clientDisplayName,
        title: revision.title,
        conditions: revision.conditions,
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
        (revision) => revision.version === quote.version,
      );
      if (currentRevision === undefined) throw new Error('Current quote revision is missing.');
      return { ...quote, currentRevision, revisions: mappedRevisions };
    };

    const list = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              expireSentQuotes(database.sqlite, audit, now);
              return Schema.decodeUnknownSync(Schema.Array(QuoteSummaryRecord))(
                database.sqlite
                  .prepare(
                    `select quotes.id, quotes.client_id as clientId,
                      quote_revisions.client_display_name as clientDisplayName,
                      quotes.status, quotes.version, quote_revisions.title,
                      quote_revisions.currency, quote_revisions.total_cents as totalCents,
                      quotes.updated_at as updatedAt
               from quotes
               join quote_revisions on quote_revisions.quote_id = quotes.id
                 and quote_revisions.version = quotes.version
               order by quotes.updated_at desc, quotes.id`,
                  )
                  .all(),
              ).map((quote) => ({
                ...quote,
                updatedAt: DateTime.formatIso(DateTime.makeUnsafe(quote.updatedAt)),
              }));
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'list quotes', cause }),
      });
    });

    const get = Effect.fn('Quotes.get')(function* (quoteId: UlidValue) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              expireSentQuotes(database.sqlite, audit, now, quoteId);
              const detail = readDetail(quoteId);
              if (detail === undefined) throw new QuoteNotFound({ code: 'quote.not_found' });
              return detail;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof QuoteNotFound
            ? cause
            : new DatabaseError({ operation: 'get quote', cause }),
      });
    });

    const getSnapshot = Effect.fn('Quotes.getSnapshot')(function* (
      quoteId: UlidValue,
      version: number,
    ) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select render_snapshot as renderSnapshot from quote_revisions
               where quote_id = ? and version = ?`,
            )
            .get(quoteId, version);
          if (row === undefined) throw new QuoteNotFound({ code: 'quote.not_found' });
          const { renderSnapshot } = Schema.decodeUnknownSync(SnapshotRecord)(row);
          if (renderSnapshot === null) {
            throw new QuotePreviewUnavailable({ code: 'quote.preview_unavailable' });
          }
          return Schema.decodeUnknownSync(QuoteRenderSnapshot)(JSON.parse(renderSnapshot));
        },
        catch: (cause) => {
          if (cause instanceof QuoteNotFound || cause instanceof QuotePreviewUnavailable)
            return cause;
          return new DatabaseError({ operation: 'get quote render snapshot', cause });
        },
      });
    });

    const findClient = (clientId: string) => {
      const rawClient = database.sqlite
        .prepare(
          `select users.display_name as displayName, users.disabled_at as disabledAt,
                  clients.address_line_1 as addressLine1,
                  clients.address_line_2 as addressLine2,
                  clients.postal_code as postalCode, clients.city,
                  clients.country, clients.email
           from clients join users on users.id = clients.id where clients.id = ?`,
        )
        .get(clientId);
      if (rawClient === undefined) throw new ClientNotFound({ code: 'client.not_found' });
      const client = Schema.decodeUnknownSync(ClientRecord)(rawClient);
      if (client.disabledAt !== null) throw new ClientArchived({ code: 'client.archived' });
      return client;
    };

    const insertRevision = (
      quoteId: string,
      version: number,
      clientDisplayName: string,
      client: typeof ClientRecord.Type,
      issuer: IssuerSettingsValue,
      title: string,
      conditions: string,
      lines: ReadonlyArray<QuoteLineInputValue>,
      createdByUserId: string,
      now: number,
    ) => {
      const revisionId = ulid(now);
      const calculatedLines = lines.map((line, position) => ({
        id: ulid(now),
        position,
        ...line,
        description: line.description.trim(),
        ...calculateQuoteLine(line),
      }));
      const totals = calculateQuoteTotals(calculatedLines);
      const createdAt = DateTime.formatIso(DateTime.makeUnsafe(now));
      const snapshot = Schema.decodeUnknownSync(QuoteRenderSnapshot)({
        templateId: 'quote-default',
        templateVersion: 1,
        quoteId,
        revisionId,
        version,
        createdAt,
        issuer,
        client: {
          displayName: client.displayName,
          addressLine1: client.addressLine1,
          addressLine2: client.addressLine2,
          postalCode: client.postalCode,
          city: client.city,
          country: client.country,
          email: client.email,
        },
        title: title.trim(),
        conditions,
        currency: 'EUR',
        ...totals,
        lines: calculatedLines,
      });
      database.sqlite
        .prepare(
          `insert into quote_revisions
           (id, quote_id, version, client_display_name, title, conditions, currency,
             net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id,
             template_id, template_version, render_snapshot)
            values (?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, 'quote-default', 1, ?)`,
        )
        .run(
          revisionId,
          quoteId,
          version,
          clientDisplayName,
          title.trim(),
          conditions,
          totals.netTotalCents,
          totals.vatTotalCents,
          totals.totalCents,
          now,
          createdByUserId,
          JSON.stringify(snapshot),
        );
      const insertLine = database.sqlite.prepare(
        `insert into quote_lines
         (id, revision_id, position, description, quantity_milli, unit_price_cents,
          vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      calculatedLines.forEach((line) =>
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
        ),
      );
    };

    const create = Effect.fn('Quotes.create')(function* (
      request: QuoteCreateRequestValue,
      createdByUserId: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const issuer = yield* issuerSettings.get;
      const quoteId = ulid(now);
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const client = findClient(request.clientId);
              database.sqlite
                .prepare(
                  "insert into quotes (id, client_id, status, version, created_at, updated_at) values (?, ?, 'draft', 1, ?, ?)",
                )
                .run(quoteId, request.clientId, now, now);
              insertRevision(
                quoteId,
                1,
                client.displayName,
                client,
                issuer,
                request.title,
                request.conditions,
                request.lines,
                createdByUserId,
                now,
              );
              audit.insert({
                action: 'quote.created',
                actorUserId: createdByUserId,
                resourceType: 'quote',
                resourceId: quoteId,
                metadata: { clientId: request.clientId, version: '1' },
                occurredAt: now,
              });
              const detail = readDetail(quoteId);
              if (detail === undefined) throw new Error('Created quote is missing.');
              return detail;
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof ClientNotFound || cause instanceof ClientArchived) return cause;
          if (cause instanceof RangeError) {
            return new QuoteAmountTooLarge({ code: 'quote.amount_too_large' });
          }
          return new DatabaseError({ operation: 'create quote', cause });
        },
      });
    });

    const createRevision = Effect.fn('Quotes.createRevision')(function* (
      quoteId: UlidValue,
      request: QuoteRevisionCreateRequestValue,
      createdByUserId: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const issuer = yield* issuerSettings.get;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              expireSentQuotes(database.sqlite, audit, now, quoteId);
              const rawQuote = database.sqlite.prepare(`${quoteSql} where id = ?`).get(quoteId);
              if (rawQuote === undefined) throw new QuoteNotFound({ code: 'quote.not_found' });
              const quote = Schema.decodeUnknownSync(QuoteRecord)(rawQuote);
              if (quote.status !== 'draft' && quote.status !== 'expired') {
                throw new QuoteNotEditable({ code: 'quote.not_editable' });
              }
              if (quote.version !== request.expectedVersion) {
                throw new QuoteVersionConflict({
                  code: 'quote.version_conflict',
                  currentVersion: quote.version,
                });
              }
              const client = findClient(quote.clientId);
              const nextVersion = quote.version + 1;
              const updated = database.sqlite
                .prepare(
                  `update quotes set status = 'draft', version = ?, updated_at = ?
                   where id = ? and version = ? and status in ('draft', 'expired')`,
                )
                .run(nextVersion, now, quoteId, request.expectedVersion).changes;
              if (updated !== 1) {
                const currentVersion = database.sqlite
                  .prepare('select version from quotes where id = ?')
                  .pluck()
                  .get(quoteId);
                throw new QuoteVersionConflict({
                  code: 'quote.version_conflict',
                  currentVersion: Schema.decodeUnknownSync(Schema.Int)(currentVersion),
                });
              }
              insertRevision(
                quoteId,
                nextVersion,
                client.displayName,
                client,
                issuer,
                request.title,
                request.conditions,
                request.lines,
                createdByUserId,
                now,
              );
              audit.insert({
                action: 'quote.revised',
                actorUserId: createdByUserId,
                resourceType: 'quote',
                resourceId: quoteId,
                metadata: { version: String(nextVersion) },
                occurredAt: now,
              });
              const detail = readDetail(quoteId);
              if (detail === undefined) throw new Error('Updated quote is missing.');
              return detail;
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof QuoteNotFound ||
            cause instanceof QuoteNotEditable ||
            cause instanceof QuoteVersionConflict ||
            cause instanceof ClientNotFound ||
            cause instanceof ClientArchived
          ) {
            return cause;
          }
          if (cause instanceof RangeError) {
            return new QuoteAmountTooLarge({ code: 'quote.amount_too_large' });
          }
          return new DatabaseError({ operation: 'create quote revision', cause });
        },
      });
    });

    return Quotes.of({ list, get, getSnapshot, create, createRevision });
  }),
);
