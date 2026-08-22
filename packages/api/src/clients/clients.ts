import {
  ClientArchived,
  ClientEmailConflict,
  ClientNotFound,
  ClientVersionConflict,
  Ulid,
  type ClientAccessValue,
  type ClientAccessRequestValue,
  type ClientCreateRequestValue,
  type ClientListValue,
  type ClientSummaryValue,
  type ClientUpdateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Passwords } from '../authentication/password.js';
import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

const ClientRecord = Schema.Struct({
  id: Ulid,
  displayName: Schema.NonEmptyString,
  addressLine1: Schema.String,
  addressLine2: Schema.String,
  postalCode: Schema.String,
  city: Schema.String,
  country: Schema.String,
  email: Schema.String,
  archived: Schema.Number,
  updatedAt: Schema.Int,
});

const toSummary = (client: typeof ClientRecord.Type): ClientSummaryValue => ({
  id: client.id,
  displayName: client.displayName,
  addressLine1: client.addressLine1,
  addressLine2: client.addressLine2,
  postalCode: client.postalCode,
  city: client.city,
  country: client.country,
  email: client.email,
  archived: client.archived === 1,
  updatedAt: client.updatedAt,
});

export interface ClientsService {
  readonly list: Effect.Effect<ClientListValue, DatabaseError>;
  readonly get: (
    clientId: UlidValue,
  ) => Effect.Effect<ClientSummaryValue, ClientNotFound | DatabaseError>;
  readonly create: (
    request: ClientCreateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<ClientSummaryValue, DatabaseError>;
  readonly archive: (
    clientId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<ClientSummaryValue, ClientNotFound | DatabaseError>;
  readonly reactivate: (
    clientId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<ClientSummaryValue, ClientNotFound | DatabaseError>;
  readonly update: (
    clientId: UlidValue,
    request: ClientUpdateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    ClientSummaryValue,
    ClientNotFound | ClientArchived | ClientVersionConflict | DatabaseError
  >;
  readonly createAccess: (
    clientId: UlidValue,
    request: ClientAccessRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    ClientAccessValue,
    ClientNotFound | ClientArchived | ClientEmailConflict | DatabaseError
  >;
}

export class Clients extends Context.Service<Clients, ClientsService>()('@froment/api/Clients') {}

export const ClientsLive = Layer.effect(
  Clients,
  Effect.gen(function* () {
    const database = yield* Database;
    const audit = yield* Audit;
    const passwords = yield* Passwords;

    const list = Effect.try({
      try: () => {
        const rows = database.sqlite
          .prepare(
            `select clients.id, users.display_name as displayName,
                     clients.address_line_1 as addressLine1,
                     clients.address_line_2 as addressLine2,
                     clients.postal_code as postalCode, clients.city,
                     clients.country, clients.email,
                     users.disabled_at is not null as archived,
                     clients.updated_at as updatedAt
             from clients
             join users on users.id = clients.id
             order by users.display_name collate nocase, clients.id`,
          )
          .all();
        return Schema.decodeUnknownSync(Schema.Array(ClientRecord))(rows).map(toSummary);
      },
      catch: (cause) => new DatabaseError({ operation: 'list clients', cause }),
    });

    const get = Effect.fn('Clients.get')(function* (clientId: UlidValue) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select clients.id, users.display_name as displayName,
                      clients.address_line_1 as addressLine1,
                      clients.address_line_2 as addressLine2,
                      clients.postal_code as postalCode, clients.city,
                      clients.country, clients.email,
                      users.disabled_at is not null as archived,
                      clients.updated_at as updatedAt
               from clients join users on users.id = clients.id
               where clients.id = ?`,
            )
            .get(clientId);
          if (row === undefined) throw new ClientNotFound({ code: 'client.not_found' });
          return toSummary(Schema.decodeUnknownSync(ClientRecord)(row));
        },
        catch: (cause) => {
          if (cause instanceof ClientNotFound) return cause;
          return new DatabaseError({ operation: 'get client', cause });
        },
      });
    });

    const create = Effect.fn('Clients.create')(function* (
      request: ClientCreateRequestValue,
      actorUserId: UlidValue,
    ) {
      const id = ulid();
      const now = yield* Clock.currentTimeMillis;
      const displayName = request.displayName.trim();
      const fields = {
        addressLine1: request.addressLine1.trim(),
        addressLine2: request.addressLine2.trim(),
        postalCode: request.postalCode.trim(),
        city: request.city.trim(),
        country: request.country.trim(),
        email: request.email.trim(),
      };
      yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              database.sqlite
                .prepare(
                  "insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, 'client', ?, ?)",
                )
                .run(id, displayName, now, now);
              database.sqlite
                .prepare(
                  `insert into clients
                   (id, created_at, updated_at, address_line_1, address_line_2,
                    postal_code, city, country, email)
                   values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                  id,
                  now,
                  now,
                  fields.addressLine1,
                  fields.addressLine2,
                  fields.postalCode,
                  fields.city,
                  fields.country,
                  fields.email,
                );
              const assignedRole = database.sqlite
                .prepare(
                  `insert into user_roles (user_id, role_id)
                   select ?, id from roles where name = 'client'`,
                )
                .run(id).changes;
              if (assignedRole !== 1) {
                throw new Error('The client role is unavailable.');
              }
              audit.insert({
                action: 'client.created',
                actorUserId,
                resourceType: 'client',
                resourceId: id,
                occurredAt: now,
              });
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'create client', cause }),
      });
      return { id, displayName, ...fields, archived: false, updatedAt: now };
    });

    const update = Effect.fn('Clients.update')(function* (
      clientId: UlidValue,
      request: ClientUpdateRequestValue,
      actorUserId: UlidValue,
    ) {
      const clockNow = yield* Clock.currentTimeMillis;
      const displayName = request.displayName.trim();
      const fields = {
        addressLine1: request.addressLine1.trim(),
        addressLine2: request.addressLine2.trim(),
        postalCode: request.postalCode.trim(),
        city: request.city.trim(),
        country: request.country.trim(),
        email: request.email.trim(),
      };
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  `select clients.id, users.disabled_at as disabledAt,
                          clients.updated_at as updatedAt
                   from clients join users on users.id = clients.id
                   where clients.id = ?`,
                )
                .get(clientId);
              if (row === undefined) throw new ClientNotFound({ code: 'client.not_found' });
              const current = Schema.decodeUnknownSync(
                Schema.Struct({
                  id: Ulid,
                  disabledAt: Schema.NullOr(Schema.Int),
                  updatedAt: Schema.Int,
                }),
              )(row);
              if (current.disabledAt !== null) {
                throw new ClientArchived({ code: 'client.archived' });
              }
              if (current.updatedAt !== request.expectedUpdatedAt) {
                throw new ClientVersionConflict({ code: 'client.version_conflict' });
              }
              const updatedAt = Math.max(clockNow, current.updatedAt + 1);
              const changed = database.sqlite
                .prepare(
                  `update clients set address_line_1 = ?, address_line_2 = ?,
                          postal_code = ?, city = ?, country = ?, email = ?, updated_at = ?
                   where id = ? and updated_at = ?`,
                )
                .run(
                  fields.addressLine1,
                  fields.addressLine2,
                  fields.postalCode,
                  fields.city,
                  fields.country,
                  fields.email,
                  updatedAt,
                  clientId,
                  request.expectedUpdatedAt,
                ).changes;
              if (changed !== 1) {
                throw new ClientVersionConflict({ code: 'client.version_conflict' });
              }
              database.sqlite
                .prepare('update users set display_name = ?, updated_at = ? where id = ?')
                .run(displayName, updatedAt, clientId);
              audit.insert({
                action: 'client.updated',
                actorUserId,
                resourceType: 'client',
                resourceId: clientId,
                occurredAt: updatedAt,
              });
              return { id: clientId, displayName, ...fields, archived: false, updatedAt };
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof ClientNotFound ||
            cause instanceof ClientArchived ||
            cause instanceof ClientVersionConflict
          ) {
            return cause;
          }
          return new DatabaseError({ operation: 'update client', cause });
        },
      });
    });

    const archive = Effect.fn('Clients.archive')(function* (
      clientId: UlidValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  `select clients.id, users.display_name as displayName,
                           clients.address_line_1 as addressLine1,
                           clients.address_line_2 as addressLine2,
                           clients.postal_code as postalCode, clients.city,
                           clients.country, clients.email,
                           users.disabled_at is not null as archived,
                           clients.updated_at as updatedAt
                   from clients join users on users.id = clients.id
                   where clients.id = ?`,
                )
                .get(clientId);
              if (row === undefined) {
                throw new ClientNotFound({ code: 'client.not_found' });
              }
              const client = Schema.decodeUnknownSync(ClientRecord)(row);
              if (client.archived === 1) return toSummary(client);
              const updatedAt = Math.max(now, client.updatedAt + 1);
              database.sqlite
                .prepare('update clients set updated_at = ? where id = ?')
                .run(updatedAt, clientId);
              database.sqlite
                .prepare(
                  'update users set disabled_at = coalesce(disabled_at, ?), updated_at = ? where id = ?',
                )
                .run(updatedAt, updatedAt, clientId);
              database.sqlite
                .prepare(
                  'update refresh_sessions set revoked_at = coalesce(revoked_at, ?) where user_id = ?',
                )
                .run(now, clientId);
              database.sqlite
                .prepare(
                  `update quote_links set revoked_at = ?
                   where revoked_at is null and consumed_at is null and expires_at > ?
                     and revision_id in (
                       select quote_revisions.id from quote_revisions
                       join quotes on quotes.id = quote_revisions.quote_id
                       where quotes.client_id = ?
                     )`,
                )
                .run(now, now, clientId);
              audit.insert({
                action: 'client.archived',
                actorUserId,
                resourceType: 'client',
                resourceId: clientId,
                occurredAt: updatedAt,
              });
              return { ...toSummary(client), archived: true, updatedAt };
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof ClientNotFound) return cause;
          return new DatabaseError({ operation: 'archive client', cause });
        },
      });
    });

    const reactivate = Effect.fn('Clients.reactivate')(function* (
      clientId: UlidValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  `select clients.id, users.display_name as displayName,
                           clients.address_line_1 as addressLine1,
                           clients.address_line_2 as addressLine2,
                           clients.postal_code as postalCode, clients.city,
                           clients.country, clients.email,
                           users.disabled_at is not null as archived,
                           clients.updated_at as updatedAt
                   from clients join users on users.id = clients.id
                   where clients.id = ?`,
                )
                .get(clientId);
              if (row === undefined) {
                throw new ClientNotFound({ code: 'client.not_found' });
              }
              const client = Schema.decodeUnknownSync(ClientRecord)(row);
              if (client.archived === 0) return toSummary(client);
              const updatedAt = Math.max(now, client.updatedAt + 1);
              database.sqlite
                .prepare('update clients set updated_at = ? where id = ?')
                .run(updatedAt, clientId);
              database.sqlite
                .prepare('update users set disabled_at = null, updated_at = ? where id = ?')
                .run(updatedAt, clientId);
              audit.insert({
                action: 'client.reactivated',
                actorUserId,
                resourceType: 'client',
                resourceId: clientId,
                occurredAt: updatedAt,
              });
              return { ...toSummary(client), archived: false, updatedAt };
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof ClientNotFound) return cause;
          return new DatabaseError({ operation: 'reactivate client', cause });
        },
      });
    });

    const createAccess = Effect.fn('Clients.createAccess')(function* (
      clientId: UlidValue,
      request: ClientAccessRequestValue,
      actorUserId: UlidValue,
    ) {
      const email = request.email.trim().toLowerCase();
      const passwordHash = yield* passwords.hash(request.password).pipe(Effect.orDie);
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  `select users.disabled_at as disabledAt
                   from clients join users on users.id = clients.id
                   where clients.id = ?`,
                )
                .get(clientId);
              if (row === undefined) {
                throw new ClientNotFound({ code: 'client.not_found' });
              }
              const client = Schema.decodeUnknownSync(
                Schema.Struct({ disabledAt: Schema.NullOr(Schema.Number) }),
              )(row);
              if (client.disabledAt !== null) {
                throw new ClientArchived({ code: 'client.archived' });
              }
              const existingEmail = database.sqlite
                .prepare('select user_id from password_credentials where email = ?')
                .pluck()
                .get(email);
              if (existingEmail !== undefined && existingEmail !== clientId) {
                throw new ClientEmailConflict({ code: 'client.email_conflict' });
              }
              database.sqlite
                .prepare(
                  'update refresh_sessions set revoked_at = ? where user_id = ? and revoked_at is null',
                )
                .run(now, clientId);
              database.sqlite
                .prepare(
                  `insert into password_credentials
                     (user_id, email, password_hash, created_at, updated_at, password_changed_at)
                   values (?, ?, ?, ?, ?, ?)
                   on conflict(user_id) do update set
                     email = excluded.email,
                     password_hash = excluded.password_hash,
                     updated_at = excluded.updated_at,
                     password_changed_at = excluded.password_changed_at`,
                )
                .run(clientId, email, passwordHash, now, now, now);
              audit.insert({
                action: 'client.access-created',
                actorUserId,
                resourceType: 'client',
                resourceId: clientId,
                metadata: {},
                occurredAt: now,
              });
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof ClientNotFound ||
            cause instanceof ClientArchived ||
            cause instanceof ClientEmailConflict
          ) {
            return cause;
          }
          return new DatabaseError({ operation: 'create client access', cause });
        },
      });
      return { clientId, email };
    });

    return Clients.of({ list, get, create, update, archive, reactivate, createAccess });
  }),
);
