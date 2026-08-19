import { sql } from 'drizzle-orm';
import { createSelectSchema } from 'drizzle-orm/effect-schema';
import {
  blob,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { Schema } from 'effect';

export const users = sqliteTable(
  'users',
  {
    id: text().notNull().primaryKey(),
    displayName: text('display_name').notNull(),
    kind: text({ enum: ['administrator', 'client'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    disabledAt: integer('disabled_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    check(
      'users_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('users_kind_check', sql`${table.kind} in ('administrator', 'client')`),
    check('users_display_name_check', sql`length(trim(${table.displayName})) > 0`),
    check('users_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
    check(
      'users_disabled_at_check',
      sql`${table.disabledAt} is null or ${table.disabledAt} >= ${table.createdAt}`,
    ),
  ],
);

export const clients = sqliteTable(
  'clients',
  {
    id: text()
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    check(
      'clients_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('clients_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
    check(
      'clients_archived_at_check',
      sql`${table.archivedAt} is null or ${table.archivedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const accessCredentials = sqliteTable(
  'access_credentials',
  {
    id: text().notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secretHmac: blob('secret_hmac', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('access_credentials_secret_hmac_unique').on(table.secretHmac),
    index('access_credentials_user_id_index').on(table.userId),
    check(
      'access_credentials_secret_hmac_check',
      sql`typeof(${table.secretHmac}) = 'blob' and length(${table.secretHmac}) = 32`,
    ),
    check(
      'access_credentials_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'access_credentials_timestamps_check',
      sql`(${table.lastUsedAt} is null or ${table.lastUsedAt} >= ${table.createdAt}) and (${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt})`,
    ),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text().notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHmac: blob('token_hmac', { mode: 'buffer' }).notNull(),
    csrfHmac: blob('csrf_hmac', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    idleExpiresAt: integer('idle_expires_at', { mode: 'timestamp_ms' }).notNull(),
    absoluteExpiresAt: integer('absolute_expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('sessions_token_hmac_unique').on(table.tokenHmac),
    index('sessions_user_id_index').on(table.userId),
    index('sessions_idle_expiry_index').on(table.idleExpiresAt),
    index('sessions_absolute_expiry_index').on(table.absoluteExpiresAt),
    check(
      'sessions_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'sessions_token_hmac_check',
      sql`typeof(${table.tokenHmac}) = 'blob' and length(${table.tokenHmac}) = 32`,
    ),
    check(
      'sessions_csrf_hmac_check',
      sql`typeof(${table.csrfHmac}) = 'blob' and length(${table.csrfHmac}) = 32`,
    ),
    check(
      'sessions_timestamps_check',
      sql`${table.lastSeenAt} >= ${table.createdAt} and ${table.idleExpiresAt} > ${table.createdAt} and ${table.absoluteExpiresAt} >= ${table.idleExpiresAt} and (${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt})`,
    ),
  ],
);

export const roles = sqliteTable(
  'roles',
  {
    id: text().notNull().primaryKey(),
    name: text().notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check(
      'roles_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('roles_name_check', sql`length(trim(${table.name})) > 0`),
  ],
);

export const permissions = sqliteTable(
  'permissions',
  {
    code: text().notNull().primaryKey(),
  },
  (table) => [
    check(
      'permissions_code_check',
      sql`${table.code} is not null and length(trim(${table.code})) > 0`,
    ),
  ],
);

export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index('user_roles_role_id_index').on(table.roleId),
  ],
);

export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permissions.code, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionCode] }),
    index('role_permissions_permission_code_index').on(table.permissionCode),
  ],
);

const ulid = (schema: typeof Schema.String) =>
  schema.check(Schema.isPattern(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/));

export const UserRow = createSelectSchema(users, {
  id: ulid,
  displayName: Schema.NonEmptyString,
});
export interface UserRow extends Schema.Schema.Type<typeof UserRow> {}

export const ClientRow = createSelectSchema(clients, { id: ulid });
export interface ClientRow extends Schema.Schema.Type<typeof ClientRow> {}

export const AccessCredentialRow = createSelectSchema(accessCredentials, {
  id: ulid,
  userId: ulid,
});
export interface AccessCredentialRow extends Schema.Schema.Type<typeof AccessCredentialRow> {}

export const SessionRow = createSelectSchema(sessions, {
  id: ulid,
  userId: ulid,
});
export interface SessionRow extends Schema.Schema.Type<typeof SessionRow> {}
