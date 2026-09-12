import {
  SupplierArchived,
  SupplierCreateRequest,
  SupplierCreationConflict,
  SupplierNotFound,
  SupplierSummary,
  SupplierVersionConflict,
  Ulid,
  type SupplierCreateRequestValue,
  type SupplierListValue,
  type SupplierSummaryValue,
  type SupplierUpdateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

const SupplierRecord = Schema.Struct({
  id: Ulid,
  displayName: Schema.NonEmptyString,
  addressLine1: Schema.String,
  addressLine2: Schema.String,
  postalCode: Schema.String,
  city: Schema.String,
  country: Schema.String,
  email: Schema.String,
  phone: Schema.String,
  registrationNumber: Schema.String,
  vatNumber: Schema.String,
  defaultCurrency: Schema.String,
  paymentTermsDays: Schema.Int,
  iban: Schema.String,
  bic: Schema.String,
  archived: Schema.Number,
  updatedAt: Schema.Int,
});

const CreationRecord = Schema.Struct({
  createdByUserId: Ulid,
  request: Schema.fromJsonString(SupplierCreateRequest),
  result: Schema.fromJsonString(SupplierSummary),
});

const selectSupplier = `select id, display_name as displayName,
  address_line_1 as addressLine1, address_line_2 as addressLine2,
  postal_code as postalCode, city, country, email, phone,
  registration_number as registrationNumber, vat_number as vatNumber,
  default_currency as defaultCurrency, payment_terms_days as paymentTermsDays,
  iban, bic, archived, updated_at as updatedAt from suppliers`;

const toSummary = (record: typeof SupplierRecord.Type): SupplierSummaryValue => ({
  ...record,
  archived: record.archived === 1,
});

const normalizedFields = (
  input: SupplierCreateRequestValue | SupplierUpdateRequestValue,
): Omit<SupplierSummaryValue, 'id' | 'archived' | 'updatedAt'> => ({
  displayName: input.displayName.trim(),
  addressLine1: input.addressLine1.trim(),
  addressLine2: input.addressLine2.trim(),
  postalCode: input.postalCode.trim(),
  city: input.city.trim(),
  country: input.country.trim(),
  email: input.email.trim().toLowerCase(),
  phone: input.phone.trim(),
  registrationNumber: input.registrationNumber.trim(),
  vatNumber: input.vatNumber.replaceAll(/\s/g, '').toUpperCase(),
  defaultCurrency: input.defaultCurrency,
  paymentTermsDays: input.paymentTermsDays,
  iban: input.iban.replaceAll(/\s/g, '').toUpperCase(),
  bic: input.bic.replaceAll(/\s/g, '').toUpperCase(),
});

const fieldValues = (fields: ReturnType<typeof normalizedFields>) =>
  [
    fields.displayName,
    fields.addressLine1,
    fields.addressLine2,
    fields.postalCode,
    fields.city,
    fields.country,
    fields.email,
    fields.phone,
    fields.registrationNumber,
    fields.vatNumber,
    fields.defaultCurrency,
    fields.paymentTermsDays,
    fields.iban,
    fields.bic,
  ] as const;

export interface SuppliersService {
  readonly list: Effect.Effect<SupplierListValue, DatabaseError>;
  readonly get: (
    supplierId: UlidValue,
  ) => Effect.Effect<SupplierSummaryValue, SupplierNotFound | DatabaseError>;
  readonly create: (
    request: SupplierCreateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<SupplierSummaryValue, SupplierCreationConflict | DatabaseError>;
  readonly update: (
    supplierId: UlidValue,
    request: SupplierUpdateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    SupplierSummaryValue,
    SupplierNotFound | SupplierArchived | SupplierVersionConflict | DatabaseError
  >;
  readonly archive: (
    supplierId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<SupplierSummaryValue, SupplierNotFound | DatabaseError>;
  readonly reactivate: (
    supplierId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<SupplierSummaryValue, SupplierNotFound | DatabaseError>;
}

export class Suppliers extends Context.Service<Suppliers, SuppliersService>()(
  '@froment/api/Suppliers',
) {}

export const SuppliersLive = Layer.effect(
  Suppliers,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const audit = yield* Audit;

    const read = (supplierId: UlidValue) => {
      const row = sqlite.prepare(`${selectSupplier} where id = ?`).get(supplierId);
      if (row === undefined) throw new SupplierNotFound({ code: 'supplier.not_found' });
      return toSummary(Schema.decodeUnknownSync(SupplierRecord)(row));
    };

    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(SupplierRecord))(
          sqlite.prepare(`${selectSupplier} order by display_name collate nocase, id`).all(),
        ).map(toSummary),
      catch: (cause) => new DatabaseError({ operation: 'list.suppliers', cause }),
    });

    const get = Effect.fn('Suppliers.get')(function* (supplierId: UlidValue) {
      return yield* Effect.try({
        try: () => read(supplierId),
        catch: (cause) =>
          cause instanceof SupplierNotFound
            ? cause
            : new DatabaseError({ operation: 'get.supplier', cause }),
      });
    });

    const create = Effect.fn('Suppliers.create')(function* (
      request: SupplierCreateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const fields = normalizedFields(request);
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const existing = sqlite
                .prepare(
                  'select created_by_user_id as createdByUserId, request, result from supplier_creation_requests where request_id = ?',
                )
                .get(request.requestId);
              if (existing !== undefined) {
                const saved = Schema.decodeUnknownSync(CreationRecord)(existing);
                if (
                  saved.createdByUserId !== actorUserId ||
                  !isDeepStrictEqual(saved.request, request)
                ) {
                  throw new SupplierCreationConflict({ code: 'supplier.creation_conflict' });
                }
                return saved.result;
              }
              const id = ulid(now);
              sqlite
                .prepare(
                  `insert into suppliers
                   (id, display_name, address_line_1, address_line_2, postal_code, city,
                    country, email, phone, registration_number, vat_number, default_currency,
                    payment_terms_days, iban, bic, archived, created_at, updated_at)
                   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                )
                .run(id, ...fieldValues(fields), now, now);
              const result = { id, ...fields, archived: false, updatedAt: now };
              audit.insert({
                action: 'supplier.created',
                actorUserId,
                resourceType: 'supplier',
                resourceId: id,
                occurredAt: now,
              });
              sqlite
                .prepare(
                  'insert into supplier_creation_requests (request_id, created_by_user_id, supplier_id, request, result) values (?, ?, ?, ?, ?)',
                )
                .run(
                  request.requestId,
                  actorUserId,
                  id,
                  JSON.stringify(request),
                  JSON.stringify(result),
                );
              return result;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof SupplierCreationConflict
            ? cause
            : new DatabaseError({ operation: 'create.supplier', cause }),
      });
    });

    const update = Effect.fn('Suppliers.update')(function* (
      supplierId: UlidValue,
      request: SupplierUpdateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const fields = normalizedFields(request);
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const current = read(supplierId);
              if (current.archived) throw new SupplierArchived({ code: 'supplier.archived' });
              if (current.updatedAt !== request.expectedUpdatedAt) {
                throw new SupplierVersionConflict({ code: 'supplier.version_conflict' });
              }
              const updatedAt = Math.max(now, current.updatedAt + 1);
              const changed = sqlite
                .prepare(
                  `update suppliers set display_name = ?, address_line_1 = ?, address_line_2 = ?,
                   postal_code = ?, city = ?, country = ?, email = ?, phone = ?,
                   registration_number = ?, vat_number = ?, default_currency = ?,
                   payment_terms_days = ?, iban = ?, bic = ?, updated_at = ?
                   where id = ? and updated_at = ?`,
                )
                .run(
                  ...fieldValues(fields),
                  updatedAt,
                  supplierId,
                  request.expectedUpdatedAt,
                ).changes;
              if (changed !== 1) {
                throw new SupplierVersionConflict({ code: 'supplier.version_conflict' });
              }
              audit.insert({
                action: 'supplier.updated',
                actorUserId,
                resourceType: 'supplier',
                resourceId: supplierId,
                occurredAt: updatedAt,
              });
              return { id: supplierId, ...fields, archived: false, updatedAt };
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof SupplierNotFound ||
            cause instanceof SupplierArchived ||
            cause instanceof SupplierVersionConflict
          ) {
            return cause;
          }
          return new DatabaseError({ operation: 'update.supplier', cause });
        },
      });
    });

    const setArchived = Effect.fn('Suppliers.setArchived')(function* (
      supplierId: UlidValue,
      archived: boolean,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const current = read(supplierId);
              if (current.archived === archived) return current;
              const updatedAt = Math.max(now, current.updatedAt + 1);
              sqlite
                .prepare('update suppliers set archived = ?, updated_at = ? where id = ?')
                .run(archived ? 1 : 0, updatedAt, supplierId);
              audit.insert({
                action: archived ? 'supplier.archived' : 'supplier.reactivated',
                actorUserId,
                resourceType: 'supplier',
                resourceId: supplierId,
                occurredAt: updatedAt,
              });
              return { ...current, archived, updatedAt };
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof SupplierNotFound
            ? cause
            : new DatabaseError({ operation: 'archive.supplier', cause }),
      });
    });

    return {
      list,
      get,
      create,
      update,
      archive: (supplierId, actorUserId) => setArchived(supplierId, true, actorUserId),
      reactivate: (supplierId, actorUserId) => setArchived(supplierId, false, actorUserId),
    };
  }),
);
