import {
  CatalogItem,
  CatalogItemNotFound,
  CatalogItemVersionConflict,
  type CatalogItemValue,
  type CatalogItemListValue,
  type CatalogItemCreateRequestValue,
  type CatalogItemUpdateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';
import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

type WriteError = DatabaseError | CatalogItemNotFound | CatalogItemVersionConflict;
export class Catalog extends Context.Service<
  Catalog,
  {
    readonly list: Effect.Effect<CatalogItemListValue, DatabaseError>;
    readonly create: (
      request: CatalogItemCreateRequestValue,
      actor: UlidValue,
    ) => Effect.Effect<CatalogItemValue, DatabaseError>;
    readonly update: (
      id: UlidValue,
      request: CatalogItemUpdateRequestValue,
      actor: UlidValue,
    ) => Effect.Effect<CatalogItemValue, WriteError>;
  }
>()('@froment/api/Catalog') {}

const selectItems = `select id, description, quantity_milli as quantityMilli, unit_price_cents as unitPriceCents,
  vat_rate_basis_points as vatRateBasisPoints, currency, version, archived from catalog_items`;
const Record = Schema.Struct({ ...CatalogItem.fields, archived: Schema.Literals([0, 1]) });
const decode = (record: typeof Record.Type): CatalogItemValue => {
  return { ...record, archived: record.archived === 1 };
};

export const CatalogLive = Layer.effect(
  Catalog,
  Effect.gen(function* () {
    const database = yield* Database;
    const audit = yield* Audit;
    const read = (id: string) => {
      const row = database.sqlite.prepare(`${selectItems} where id = ?`).get(id);
      if (row === undefined) throw new CatalogItemNotFound({ code: 'catalog.not_found' });
      return decode(Schema.decodeUnknownSync(Record)(row));
    };
    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Record))(
          database.sqlite
            .prepare(`${selectItems} order by archived, description collate nocase, id`)
            .all(),
        ).map(decode),
      catch: (cause) => new DatabaseError({ operation: 'list.catalog', cause }),
    });
    const create = Effect.fn('Catalog.create')(function* (
      request: CatalogItemCreateRequestValue,
      actor: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const id = ulid(now);
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              database.sqlite
                .prepare(`insert into catalog_items
          (id, description, quantity_milli, unit_price_cents, vat_rate_basis_points, currency, version, archived, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`)
                .run(
                  id,
                  request.description.trim(),
                  request.quantityMilli,
                  request.unitPriceCents,
                  request.vatRateBasisPoints,
                  request.currency,
                  now,
                  now,
                );
              audit.insert({
                action: 'catalog.created',
                actorUserId: actor,
                resourceType: 'catalog-item',
                resourceId: id,
                occurredAt: now,
              });
              return read(id);
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'create.catalog', cause }),
      });
    });
    const update = Effect.fn('Catalog.update')(function* (
      id: UlidValue,
      request: CatalogItemUpdateRequestValue,
      actor: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const current = read(id);
              if (current.version !== request.expectedVersion)
                throw new CatalogItemVersionConflict({ code: 'catalog.version_conflict' });
              database.sqlite
                .prepare(`update catalog_items set description = ?, quantity_milli = ?, unit_price_cents = ?,
          vat_rate_basis_points = ?, currency = ?, version = version + 1, archived = ?, updated_at = ? where id = ?`)
                .run(
                  request.description.trim(),
                  request.quantityMilli,
                  request.unitPriceCents,
                  request.vatRateBasisPoints,
                  request.currency,
                  Number(request.archived),
                  now,
                  id,
                );
              audit.insert({
                action: 'catalog.updated',
                actorUserId: actor,
                resourceType: 'catalog-item',
                resourceId: id,
                metadata: {
                  archived: String(request.archived),
                  version: String(current.version + 1),
                },
                occurredAt: now,
              });
              return read(id);
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof CatalogItemNotFound || cause instanceof CatalogItemVersionConflict
            ? cause
            : new DatabaseError({ operation: 'update.catalog', cause }),
      });
    });
    return Catalog.of({ list, create, update });
  }),
);
