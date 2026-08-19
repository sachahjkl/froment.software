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
    addressLine1: text('address_line_1').notNull().default(''),
    addressLine2: text('address_line_2').notNull().default(''),
    postalCode: text('postal_code').notNull().default(''),
    city: text().notNull().default(''),
    country: text().notNull().default(''),
    email: text().notNull().default(''),
  },
  (table) => [
    check(
      'clients_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('clients_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
    check(
      'clients_document_fields_check',
      sql`length(${table.addressLine1}) <= 160 and length(${table.addressLine2}) <= 160 and length(${table.postalCode}) <= 32 and length(${table.city}) <= 120 and length(${table.country}) <= 120 and length(${table.email}) <= 254`,
    ),
  ],
);

export const issuerSettings = sqliteTable(
  'issuer_settings',
  {
    id: integer().notNull().primaryKey(),
    displayName: text('display_name').notNull(),
    addressLine1: text('address_line_1').notNull(),
    addressLine2: text('address_line_2').notNull(),
    postalCode: text('postal_code').notNull(),
    city: text().notNull(),
    country: text().notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    registrationNumber: text('registration_number').notNull(),
    vatNumber: text('vat_number').notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('issuer_settings_singleton_check', sql`${table.id} = 1`),
    check(
      'issuer_settings_fields_check',
      sql`length(trim(${table.displayName})) between 1 and 160 and length(${table.addressLine1}) <= 160 and length(${table.addressLine2}) <= 160 and length(${table.postalCode}) <= 32 and length(${table.city}) <= 120 and length(${table.country}) <= 120 and length(${table.email}) <= 254 and length(${table.phone}) <= 64 and length(${table.registrationNumber}) <= 64 and length(${table.vatNumber}) <= 64`,
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

export const quotes = sqliteTable(
  'quotes',
  {
    id: text().notNull().primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'no action' }),
    status: text({
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
    }).notNull(),
    version: integer().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('quotes_client_id_index').on(table.clientId),
    check(
      'quotes_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'quotes_status_check',
      sql`${table.status} in ('draft', 'sent', 'accepted', 'rejected', 'expired')`,
    ),
    check('quotes_version_check', sql`${table.version} >= 1`),
    check('quotes_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const quoteRevisions = sqliteTable(
  'quote_revisions',
  {
    id: text().notNull().primaryKey(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    clientDisplayName: text('client_display_name').notNull(),
    title: text().notNull(),
    conditions: text().notNull(),
    currency: text({ enum: ['EUR'] }).notNull(),
    netTotalCents: integer('net_total_cents').notNull(),
    vatTotalCents: integer('vat_total_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'no action' }),
    templateId: text('template_id'),
    templateVersion: integer('template_version'),
    renderSnapshot: text('render_snapshot'),
  },
  (table) => [
    uniqueIndex('quote_revisions_quote_id_version_unique').on(table.quoteId, table.version),
    index('quote_revisions_created_by_user_id_index').on(table.createdByUserId),
    check(
      'quote_revisions_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('quote_revisions_version_check', sql`${table.version} >= 1`),
    check(
      'quote_revisions_client_display_name_check',
      sql`length(trim(${table.clientDisplayName})) > 0`,
    ),
    check('quote_revisions_title_check', sql`length(trim(${table.title})) between 1 and 120`),
    check('quote_revisions_conditions_check', sql`length(${table.conditions}) <= 2000`),
    check('quote_revisions_currency_check', sql`${table.currency} = 'EUR'`),
    check(
      'quote_revisions_totals_check',
      sql`${table.netTotalCents} between 0 and 9007199254740991 and ${table.vatTotalCents} between 0 and 9007199254740991 and ${table.totalCents} between 0 and 9007199254740991 and ${table.totalCents} = ${table.netTotalCents} + ${table.vatTotalCents}`,
    ),
    check(
      'quote_revisions_render_check',
      sql`(${table.renderSnapshot} is null and ${table.templateId} is null and ${table.templateVersion} is null) or (${table.renderSnapshot} is not null and ${table.templateId} = 'quote-default' and ${table.templateVersion} = 1 and json_valid(${table.renderSnapshot}))`,
    ),
  ],
);

export const quoteLines = sqliteTable(
  'quote_lines',
  {
    id: text().notNull().primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    description: text().notNull(),
    quantityMilli: integer('quantity_milli').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    vatRateBasisPoints: integer('vat_rate_basis_points').notNull(),
    netTotalCents: integer('net_total_cents').notNull(),
    vatTotalCents: integer('vat_total_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
  },
  (table) => [
    uniqueIndex('quote_lines_revision_id_position_unique').on(table.revisionId, table.position),
    check(
      'quote_lines_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('quote_lines_position_check', sql`${table.position} between 0 and 19`),
    check(
      'quote_lines_description_check',
      sql`length(trim(${table.description})) between 1 and 160`,
    ),
    check(
      'quote_lines_input_check',
      sql`${table.quantityMilli} between 1 and 9007199254740991 and ${table.unitPriceCents} between 0 and 9007199254740991 and ${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check(
      'quote_lines_totals_check',
      sql`${table.netTotalCents} between 0 and 9007199254740991 and ${table.vatTotalCents} between 0 and 9007199254740991 and ${table.totalCents} between 0 and 9007199254740991 and ${table.totalCents} = ${table.netTotalCents} + ${table.vatTotalCents}`,
    ),
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
