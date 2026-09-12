import {
  Affair,
  AffairConflict,
  AffairCreateRequest,
  AffairList,
  AffairNotFound,
  AffairQuoteLinkRequest,
  AffairUpdateRequest,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';
import { Audit } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { allocateBusinessReference, businessYear } from '../business/business-references.js';
import { Database, DatabaseError } from '../database/database.js';

const Row = Schema.Struct({
  id: Affair.fields.id,
  requestId: Affair.fields.requestId,
  reference: Affair.fields.reference,
  clientId: Affair.fields.clientId,
  clientDisplayName: Affair.fields.clientDisplayName,
  title: Affair.fields.title,
  status: Affair.fields.status,
  version: Affair.fields.version,
  createdAt: Schema.Int,
  updatedAt: Schema.Int,
  quoteIds: Schema.fromJsonString(Affair.fields.quoteIds),
  orderIds: Schema.fromJsonString(Affair.fields.orderIds),
  invoiceIds: Schema.fromJsonString(Affair.fields.invoiceIds),
});

const select = `select a.id, a.request_id as requestId, a.reference, a.client_id as clientId,
  users.display_name as clientDisplayName, a.title, a.status, a.version,
  a.created_at as createdAt, a.updated_at as updatedAt,
  coalesce((select json_group_array(aq.quote_id) from affair_quotes aq where aq.affair_id = a.id), '[]') as quoteIds,
  coalesce((select json_group_array(o.id) from orders o join affair_quotes aq on aq.quote_id = o.quote_id where aq.affair_id = a.id), '[]') as orderIds,
  coalesce((select json_group_array(i.id) from invoices i join orders o on o.id = i.order_id join affair_quotes aq on aq.quote_id = o.quote_id where aq.affair_id = a.id), '[]') as invoiceIds
  from affairs a join users on users.id = a.client_id`;

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const business = yield* BusinessConfig;
  const notFound = () => new AffairNotFound({ code: 'affair.not_found' });
  const conflict = () => new AffairConflict({ code: 'affair.conflict' });

  const decode = (value: typeof Row.Type) => {
    return Affair.make({
      ...value,
      createdAt: DateTime.formatIso(DateTime.makeUnsafe(value.createdAt)),
      updatedAt: DateTime.formatIso(DateTime.makeUnsafe(value.updatedAt)),
    });
  };
  const read = (id: string) => {
    const row = sqlite.prepare(`${select} where a.id = ?`).get(id);
    if (row === undefined) throw notFound();
    return decode(Schema.decodeUnknownSync(Row)(row));
  };

  const list = Effect.fn('Affairs.list')(() =>
    Effect.try({
      try: () =>
        Schema.decodeUnknownSync(AffairList)(
          sqlite
            .prepare(`${select} order by a.updated_at desc, a.id limit 10000`)
            .all()
            .map((row) => decode(Schema.decodeUnknownSync(Row)(row))),
        ),
      catch: (cause) => new DatabaseError({ operation: 'affair.list', cause }),
    }),
  );

  const get = Effect.fn('Affairs.get')((id: string) =>
    Effect.try({
      try: () => read(id),
      catch: (cause) =>
        cause instanceof AffairNotFound
          ? cause
          : new DatabaseError({ operation: 'affair.get', cause }),
    }),
  );

  const create = Effect.fn('Affairs.create')(function* (
    request: typeof AffairCreateRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const existing = sqlite
              .prepare('select id, client_id as clientId, title from affairs where request_id = ?')
              .get(request.requestId);
            if (existing !== undefined) {
              const saved = Schema.decodeUnknownSync(
                Schema.Struct({ id: Schema.String, clientId: Schema.String, title: Schema.String }),
              )(existing);
              if (saved.clientId !== request.clientId || saved.title !== request.title.trim())
                throw conflict();
              return read(saved.id);
            }
            if (
              sqlite.prepare('select 1 from clients where id = ?').get(request.clientId) ===
              undefined
            )
              throw conflict();
            const id = ulid(now);
            const reference = allocateBusinessReference(
              sqlite,
              'affair',
              businessYear(now, business.timeZone),
            );
            sqlite
              .prepare(
                `insert into affairs
                 (id, request_id, reference, client_id, title, status, version, created_at, updated_at)
                 values (?, ?, ?, ?, ?, 'open', 1, ?, ?)`,
              )
              .run(
                id,
                request.requestId,
                reference,
                request.clientId,
                request.title.trim(),
                now,
                now,
              );
            audit.insert({
              action: 'affair.created',
              actorUserId: actor,
              resourceType: 'affair',
              resourceId: id,
              occurredAt: now,
              metadata: { reference },
            });
            return read(id);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof AffairConflict
          ? cause
          : new DatabaseError({ operation: 'affair.create', cause }),
    });
  });

  const update = Effect.fn('Affairs.update')(function* (
    id: string,
    request: typeof AffairUpdateRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const saved = read(id);
            if (saved.version !== request.expectedVersion) throw conflict();
            sqlite
              .prepare(
                'update affairs set title = ?, status = ?, version = version + 1, updated_at = ? where id = ?',
              )
              .run(request.title.trim(), request.status, now, id);
            audit.insert({
              action: 'affair.updated',
              actorUserId: actor,
              resourceType: 'affair',
              resourceId: id,
              occurredAt: now,
              metadata: { status: request.status },
            });
            return read(id);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof AffairNotFound || cause instanceof AffairConflict
          ? cause
          : new DatabaseError({ operation: 'affair.update', cause }),
    });
  });

  const linkQuote = Effect.fn('Affairs.linkQuote')(function* (
    id: string,
    request: typeof AffairQuoteLinkRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const saved = read(id);
            if (saved.version !== request.expectedVersion) throw conflict();
            const quote = sqlite
              .prepare('select client_id as clientId from quotes where id = ?')
              .get(request.quoteId);
            if (
              quote === undefined ||
              Schema.decodeUnknownSync(Schema.Struct({ clientId: Schema.String }))(quote)
                .clientId !== saved.clientId
            )
              throw conflict();
            const existing = sqlite
              .prepare('select affair_id from affair_quotes where quote_id = ?')
              .pluck()
              .get(request.quoteId);
            const existingAffairId =
              existing === undefined
                ? undefined
                : Schema.decodeUnknownSync(Schema.String)(existing);
            if (existingAffairId !== id) {
              if (existingAffairId !== undefined) {
                sqlite.prepare('delete from affair_quotes where quote_id = ?').run(request.quoteId);
                sqlite
                  .prepare('update affairs set version = version + 1, updated_at = ? where id = ?')
                  .run(now, existingAffairId);
              }
              sqlite
                .prepare(
                  'insert into affair_quotes (affair_id, quote_id, linked_at, linked_by_user_id) values (?, ?, ?, ?)',
                )
                .run(id, request.quoteId, now, actor);
              sqlite
                .prepare('update affairs set version = version + 1, updated_at = ? where id = ?')
                .run(now, id);
              audit.insert({
                action: 'affair.quote-linked',
                actorUserId: actor,
                resourceType: 'affair',
                resourceId: id,
                occurredAt: now,
                metadata: { quoteId: request.quoteId },
              });
            }
            return read(id);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof AffairNotFound || cause instanceof AffairConflict
          ? cause
          : new DatabaseError({ operation: 'affair.quote-link', cause }),
    });
  });

  return { list, get, create, update, linkQuote };
});

export class Affairs extends Context.Service<Affairs, Effect.Success<typeof make>>()(
  '@froment/api/Affairs',
) {}

export const AffairsLive = Layer.effect(Affairs, make);
