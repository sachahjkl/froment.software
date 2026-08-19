import {
  ClientArchived,
  ClientNotFound,
  Ulid,
  type ClientAccessValue,
  type ClientCreateRequestValue,
  type ClientListValue,
  type ClientSummaryValue,
  type UlidValue,
} from '@froment/contracts';
import { Context, Effect, Layer, Schema } from 'effect';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { Database, DatabaseError } from '../database/database.js';

const ClientRecord = Schema.Struct({
  id: Ulid,
  displayName: Schema.NonEmptyString,
  archived: Schema.Number,
});

const toSummary = (client: typeof ClientRecord.Type): ClientSummaryValue => ({
  id: client.id,
  displayName: client.displayName,
  archived: client.archived === 1,
});

export interface ClientsService {
  readonly list: Effect.Effect<ClientListValue, DatabaseError>;
  readonly create: (
    request: ClientCreateRequestValue,
  ) => Effect.Effect<ClientSummaryValue, DatabaseError>;
  readonly archive: (
    clientId: UlidValue,
  ) => Effect.Effect<ClientSummaryValue, ClientNotFound | DatabaseError>;
  readonly createAccess: (
    clientId: UlidValue,
  ) => Effect.Effect<ClientAccessValue, ClientNotFound | ClientArchived | DatabaseError>;
}

export class Clients extends Context.Service<Clients, ClientsService>()('@froment/api/Clients') {}

export const ClientsLive = Layer.effect(
  Clients,
  Effect.gen(function* () {
    const database = yield* Database;
    const config = yield* AuthenticationConfig;

    const list = Effect.try({
      try: () => {
        const rows = database.sqlite
          .prepare(
            `select clients.id, users.display_name as displayName,
                    clients.archived_at is not null as archived
             from clients
             join users on users.id = clients.id
             order by users.display_name collate nocase, clients.id`,
          )
          .all();
        return Schema.decodeUnknownSync(Schema.Array(ClientRecord))(rows).map(toSummary);
      },
      catch: (cause) => new DatabaseError({ operation: 'list clients', cause }),
    });

    const create = Effect.fn('Clients.create')(function* (request: ClientCreateRequestValue) {
      const id = ulid();
      const now = Date.now();
      const displayName = request.displayName.trim();
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
                .prepare('insert into clients (id, created_at, updated_at) values (?, ?, ?)')
                .run(id, now, now);
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'create client', cause }),
      });
      return { id, displayName, archived: false };
    });

    const archive = Effect.fn('Clients.archive')(function* (clientId: UlidValue) {
      const now = Date.now();
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  `select clients.id, users.display_name as displayName,
                          clients.archived_at is not null as archived
                   from clients join users on users.id = clients.id
                   where clients.id = ?`,
                )
                .get(clientId);
              if (row === undefined) {
                throw new ClientNotFound({ code: 'client.not_found' });
              }
              const client = Schema.decodeUnknownSync(ClientRecord)(row);
              database.sqlite
                .prepare(
                  'update clients set archived_at = coalesce(archived_at, ?), updated_at = ? where id = ?',
                )
                .run(now, now, clientId);
              database.sqlite
                .prepare(
                  'update users set disabled_at = coalesce(disabled_at, ?), updated_at = ? where id = ?',
                )
                .run(now, now, clientId);
              database.sqlite
                .prepare(
                  'update access_credentials set revoked_at = coalesce(revoked_at, ?) where user_id = ?',
                )
                .run(now, clientId);
              database.sqlite
                .prepare(
                  'update sessions set revoked_at = coalesce(revoked_at, ?) where user_id = ?',
                )
                .run(now, clientId);
              return { ...toSummary(client), archived: true };
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof ClientNotFound) return cause;
          return new DatabaseError({ operation: 'archive client', cause });
        },
      });
    });

    const createAccess = Effect.fn('Clients.createAccess')(function* (clientId: UlidValue) {
      const accessIdentifier = randomBytes(32).toString('base64url');
      const credentialId = ulid();
      const now = Date.now();
      yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare('select archived_at as archivedAt from clients where id = ?')
                .get(clientId);
              if (row === undefined) {
                throw new ClientNotFound({ code: 'client.not_found' });
              }
              const client = Schema.decodeUnknownSync(
                Schema.Struct({ archivedAt: Schema.NullOr(Schema.Number) }),
              )(row);
              if (client.archivedAt !== null) {
                throw new ClientArchived({ code: 'client.archived' });
              }
              database.sqlite
                .prepare(
                  'insert into access_credentials (id, user_id, secret_hmac, created_at) values (?, ?, ?, ?)',
                )
                .run(credentialId, clientId, hmac(config.accessHmacKey, accessIdentifier), now);
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof ClientNotFound || cause instanceof ClientArchived) return cause;
          return new DatabaseError({ operation: 'create client access', cause });
        },
      });
      return { clientId, accessIdentifier };
    });

    return Clients.of({ list, create, archive, createAccess });
  }),
);
