import {
  ClientArchived,
  ClientNotFound,
  QuoteAmountTooLarge,
  QuoteNotFound,
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
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Database, DatabaseError } from '../database/database.js';
import { calculateQuoteLine, calculateQuoteTotals } from './quote-calculation.js';

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
  disabledAt: Schema.NullOr(Schema.Number),
});

type QuoteError =
  | QuoteNotFound
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
  total_cents as totalCents, created_at as createdAt, created_by_user_id as createdByUserId
  from quote_revisions`;
const lineSql = `select id, revision_id as revisionId, position, description,
  quantity_milli as quantityMilli, unit_price_cents as unitPriceCents,
  vat_rate_basis_points as vatRateBasisPoints, net_total_cents as netTotalCents,
  vat_total_cents as vatTotalCents, total_cents as totalCents from quote_lines`;

export const QuotesLive = Layer.effect(
  Quotes,
  Effect.gen(function* () {
    const database = yield* Database;

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

    const list = Effect.try({
      try: () => {
        const quotes = Schema.decodeUnknownSync(Schema.Array(QuoteRecord))(
          database.sqlite.prepare(`${quoteSql} order by updated_at desc, id`).all(),
        );
        return quotes.map((quote) => {
          const detail = readDetail(quote.id);
          if (detail === undefined) throw new Error('Listed quote is missing.');
          return detail;
        });
      },
      catch: (cause) => new DatabaseError({ operation: 'list quotes', cause }),
    });

    const get = Effect.fn('Quotes.get')(function* (quoteId: UlidValue) {
      return yield* Effect.try({
        try: () => {
          const detail = readDetail(quoteId);
          if (detail === undefined) throw new QuoteNotFound({ code: 'quote.not_found' });
          return detail;
        },
        catch: (cause) =>
          cause instanceof QuoteNotFound
            ? cause
            : new DatabaseError({ operation: 'get quote', cause }),
      });
    });

    const findClient = (clientId: string) => {
      const rawClient = database.sqlite
        .prepare(
          `select users.display_name as displayName, users.disabled_at as disabledAt
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
      title: string,
      conditions: string,
      lines: ReadonlyArray<QuoteLineInputValue>,
      createdByUserId: string,
      now: number,
    ) => {
      const revisionId = ulid(now);
      const calculatedLines = lines.map((line) => ({
        ...line,
        description: line.description.trim(),
        ...calculateQuoteLine(line),
      }));
      const totals = calculateQuoteTotals(calculatedLines);
      database.sqlite
        .prepare(
          `insert into quote_revisions
           (id, quote_id, version, client_display_name, title, conditions, currency,
            net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id)
           values (?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?)`,
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
        );
      const insertLine = database.sqlite.prepare(
        `insert into quote_lines
         (id, revision_id, position, description, quantity_milli, unit_price_cents,
          vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      calculatedLines.forEach((line, position) =>
        insertLine.run(
          ulid(now),
          revisionId,
          position,
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
                request.title,
                request.conditions,
                request.lines,
                createdByUserId,
                now,
              );
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
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const rawQuote = database.sqlite.prepare(`${quoteSql} where id = ?`).get(quoteId);
              if (rawQuote === undefined) throw new QuoteNotFound({ code: 'quote.not_found' });
              const quote = Schema.decodeUnknownSync(QuoteRecord)(rawQuote);
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
                  'update quotes set version = ?, updated_at = ? where id = ? and version = ?',
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
                request.title,
                request.conditions,
                request.lines,
                createdByUserId,
                now,
              );
              const detail = readDetail(quoteId);
              if (detail === undefined) throw new Error('Updated quote is missing.');
              return detail;
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof QuoteNotFound ||
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

    return Quotes.of({ list, get, create, createRevision });
  }),
);
