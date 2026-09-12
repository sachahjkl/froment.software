import {
  CustomRole,
  CustomRoleConflict,
  CustomRoleList,
  CustomRoleNotFound,
  PermissionCode,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

const CustomRoleRecord = Schema.Struct({
  id: CustomRole.fields.id,
  requestId: Schema.String,
  name: Schema.String,
  permissions: Schema.fromJsonString(Schema.Array(PermissionCode)),
  version: Schema.Int,
  createdAt: Schema.Int,
  updatedAt: Schema.Int,
});

const selectRole = `select id, request_id as requestId, name, permissions, version,
  created_at as createdAt, updated_at as updatedAt from custom_roles`;

const toRole = (record: typeof CustomRoleRecord.Type): typeof CustomRole.Type =>
  Schema.decodeUnknownSync(CustomRole)(record);

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;

  const readRole = (id: string) => {
    const row = sqlite.prepare(`${selectRole} where id = ?`).get(id);
    if (row === undefined) throw new CustomRoleNotFound({ code: 'role.not_found' });
    return toRole(Schema.decodeUnknownSync(CustomRoleRecord)(row));
  };

  const list = Effect.try({
    try: () =>
      Schema.decodeUnknownSync(CustomRoleList)(
        sqlite
          .prepare(`${selectRole} order by name collate nocase, id`)
          .all()
          .map((row) => toRole(Schema.decodeUnknownSync(CustomRoleRecord)(row))),
      ),
    catch: (cause) => new DatabaseError({ operation: 'role.list', cause }),
  });

  const get = (id: string) =>
    Effect.try({
      try: () => readRole(id),
      catch: (cause) =>
        cause instanceof CustomRoleNotFound
          ? cause
          : new DatabaseError({ operation: 'role.get', cause }),
    });

  const create = Effect.fn('Roles.create')(function* (
    request: {
      readonly requestId: string;
      readonly name: string;
      readonly permissions: ReadonlyArray<typeof PermissionCode.Type>;
    },
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const name = request.name.trim();
            const existingRequest = sqlite
              .prepare(`${selectRole} where request_id = ?`)
              .get(request.requestId);
            if (existingRequest !== undefined) {
              const existing = Schema.decodeUnknownSync(CustomRoleRecord)(existingRequest);
              if (
                existing.name !== name ||
                JSON.stringify(existing.permissions) !== JSON.stringify(request.permissions)
              ) {
                throw new CustomRoleConflict({ code: 'role.creation_conflict' });
              }
              return toRole(existing);
            }
            if (
              sqlite
                .prepare('select 1 from custom_roles where name = ? collate nocase')
                .get(name) !== undefined
            ) {
              throw new CustomRoleConflict({ code: 'role.name_exists' });
            }
            const id = ulid();
            sqlite
              .prepare(
                'insert into custom_roles (id, request_id, name, permissions, version, created_at, updated_at) values (?, ?, ?, ?, 1, ?, ?)',
              )
              .run(id, request.requestId, name, JSON.stringify(request.permissions), now, now);
            audit.insert({
              action: 'role.created',
              actorUserId,
              resourceType: 'role',
              resourceId: id,
              occurredAt: now,
            });
            return readRole(id);
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof CustomRoleConflict
          ? cause
          : new DatabaseError({ operation: 'role.create', cause }),
    });
  });

  const update = Effect.fn('Roles.update')(function* (
    id: string,
    request: {
      readonly name: string;
      readonly permissions: ReadonlyArray<typeof PermissionCode.Type>;
      readonly expectedVersion: number;
    },
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const current = readRole(id);
            if (current.version !== request.expectedVersion) {
              throw new CustomRoleConflict({ code: 'role.version_conflict' });
            }
            const name = request.name.trim();
            if (
              sqlite
                .prepare('select 1 from custom_roles where name = ? collate nocase and id <> ?')
                .get(name, id) !== undefined
            ) {
              throw new CustomRoleConflict({ code: 'role.name_exists' });
            }
            const updatedAt = Math.max(now, current.updatedAt + 1);
            sqlite
              .prepare(
                'update custom_roles set name = ?, permissions = ?, version = version + 1, updated_at = ? where id = ? and version = ?',
              )
              .run(
                name,
                JSON.stringify(request.permissions),
                updatedAt,
                id,
                request.expectedVersion,
              );
            audit.insert({
              action: 'role.updated',
              actorUserId,
              resourceType: 'role',
              resourceId: id,
              occurredAt: updatedAt,
            });
            return readRole(id);
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof CustomRoleNotFound || cause instanceof CustomRoleConflict)
          return cause;
        return new DatabaseError({ operation: 'role.update', cause });
      },
    });
  });

  const remove = Effect.fn('Roles.remove')(function* (id: string, actorUserId: UlidValue) {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            readRole(id);
            const profile = `custom:${id}`;
            const inUse =
              sqlite.prepare('select 1 from team_members where profile = ?').get(profile) !==
                undefined ||
              sqlite
                .prepare(
                  'select 1 from team_invitations where profile = ? and accepted_at is null and cancelled_at is null',
                )
                .get(profile) !== undefined;
            if (inUse) throw new CustomRoleConflict({ code: 'role.in_use' });
            sqlite.prepare('delete from custom_roles where id = ?').run(id);
            audit.insert({
              action: 'role.deleted',
              actorUserId,
              resourceType: 'role',
              resourceId: id,
              occurredAt: now,
            });
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof CustomRoleNotFound || cause instanceof CustomRoleConflict)
          return cause;
        return new DatabaseError({ operation: 'role.delete', cause });
      },
    });
  });

  return { list, get, create, update, remove };
});

export class Roles extends Context.Service<Roles, Effect.Success<typeof make>>()(
  '@froment/api/Roles',
) {}

export const RolesLive = Layer.effect(Roles, make);
