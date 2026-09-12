import { desc, sql } from 'drizzle-orm';
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

export const passwordCredentials = sqliteTable(
  'password_credentials',
  {
    userId: text('user_id')
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text().notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    passwordChangedAt: integer('password_changed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check(
      'password_credentials_email_check',
      sql`${table.email} = lower(trim(${table.email})) and length(${table.email}) between 3 and 254`,
    ),
    check(
      'password_credentials_password_hash_check',
      sql`${table.passwordHash} glob '$argon2id$*'`,
    ),
    check(
      'password_credentials_timestamps_check',
      sql`${table.updatedAt} >= ${table.createdAt} and ${table.passwordChangedAt} between ${table.createdAt} and ${table.updatedAt}`,
    ),
  ],
);

export const teamMembers = sqliteTable(
  'team_members',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id)
      .notNull(),
    profile: text().notNull(),
    version: integer().notNull(),
  },
  (table) => [
    check(
      'team_member_profile_check',
      sql`${table.profile} in ('collaborator', 'accountant') or (length(${table.profile}) = 33 and substr(${table.profile}, 1, 7) = 'custom:' and substr(${table.profile}, 8, 1) between '0' and '7' and substr(${table.profile}, 8) not glob '*[^0-9A-HJKMNP-TV-Z]*')`,
    ),
    check('team_member_version_check', sql`${table.version} > 0`),
  ],
);

export const teamInvitations = sqliteTable(
  'team_invitations',
  {
    id: text().primaryKey().notNull(),
    email: text().notNull(),
    displayName: text('display_name').notNull(),
    profile: text().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    cancelledAt: integer('cancelled_at'),
    acceptedAt: integer('accepted_at'),
  },
  (table) => [
    check(
      'team_invitation_profile_check',
      sql`${table.profile} in ('collaborator', 'accountant') or (length(${table.profile}) = 33 and substr(${table.profile}, 1, 7) = 'custom:' and substr(${table.profile}, 8, 1) between '0' and '7' and substr(${table.profile}, 8) not glob '*[^0-9A-HJKMNP-TV-Z]*')`,
    ),
    index('team_invitation_email_index').on(table.email),
  ],
);

export const emailTemplates = sqliteTable(
  'email_templates',
  {
    id: text().notNull().primaryKey(),
    content: text().notNull(),
    version: integer().notNull(),
    archived: integer({ mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
    updatedByUserId: text('updated_by_user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    check('email_templates_version_check', sql`${table.version} > 0`),
    check('email_templates_content_check', sql`json_valid(${table.content})`),
  ],
);

export const emailDrafts = sqliteTable(
  'email_drafts',
  {
    id: text().notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    content: text().notNull(),
    version: integer().notNull(),
    archived: integer({ mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('email_drafts_user_index').on(table.userId, table.archived),
    check('email_drafts_version_check', sql`${table.version} > 0`),
    check('email_drafts_content_check', sql`json_valid(${table.content})`),
  ],
);

export const passkeys = sqliteTable(
  'passkeys',
  {
    id: text().notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull().unique(),
    publicKey: blob('public_key', { mode: 'buffer' }).notNull(),
    counter: integer().notNull(),
    name: text().notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
  },
  (table) => [
    index('passkeys_user_index').on(table.userId),
    check('passkeys_counter_check', sql`${table.counter} >= 0`),
  ],
);

export const passkeyChallenges = sqliteTable(
  'passkey_challenges',
  {
    id: text().notNull().primaryKey(),
    challenge: text().notNull(),
    kind: text({ enum: ['registration', 'login'] }).notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    name: text(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [index('passkey_challenges_expiry_index').on(table.expiresAt)],
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
    phone: text().notNull().default(''),
  },
  (table) => [
    check(
      'clients_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('clients_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
    check(
      'clients_document_fields_check',
      sql`length(${table.addressLine1}) <= 160 and length(${table.addressLine2}) <= 160 and length(${table.postalCode}) <= 32 and length(${table.city}) <= 120 and length(${table.country}) <= 120 and length(${table.email}) <= 254 and length(${table.phone}) <= 64`,
    ),
  ],
);

export const clientCreationRequests = sqliteTable(
  'client_creation_requests',
  {
    requestId: text('request_id').notNull().primaryKey(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    clientId: text('client_id')
      .notNull()
      .unique()
      .references(() => clients.id),
    request: text().notNull(),
    result: text().notNull(),
  },
  (table) => [
    check('client_creation_request_json_check', sql`json_valid(${table.request})`),
    check('client_creation_result_json_check', sql`json_valid(${table.result})`),
  ],
);

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text().notNull().primaryKey(),
    displayName: text('display_name').notNull(),
    addressLine1: text('address_line_1').notNull().default(''),
    addressLine2: text('address_line_2').notNull().default(''),
    postalCode: text('postal_code').notNull().default(''),
    city: text().notNull().default(''),
    country: text().notNull().default(''),
    email: text().notNull().default(''),
    phone: text().notNull().default(''),
    registrationNumber: text('registration_number').notNull().default(''),
    vatNumber: text('vat_number').notNull().default(''),
    defaultCurrency: text('default_currency').notNull(),
    paymentTermsDays: integer('payment_terms_days').notNull().default(30),
    iban: text().notNull().default(''),
    bic: text().notNull().default(''),
    archived: integer({ mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check(
      'suppliers_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'suppliers_display_name_check',
      sql`length(trim(${table.displayName})) between 1 and 160`,
    ),
    check(
      'suppliers_fields_check',
      sql`length(${table.addressLine1}) <= 160 and length(${table.addressLine2}) <= 160 and length(${table.postalCode}) <= 32 and length(${table.city}) <= 120 and length(${table.country}) <= 120 and length(${table.email}) <= 254 and length(${table.phone}) <= 64 and length(${table.registrationNumber}) <= 64 and length(${table.vatNumber}) <= 64 and length(${table.iban}) <= 34 and length(${table.bic}) <= 11`,
    ),
    check('suppliers_currency_check', sql`${table.defaultCurrency} glob '[A-Z][A-Z][A-Z]'`),
    check('suppliers_payment_terms_check', sql`${table.paymentTermsDays} between 0 and 365`),
    check('suppliers_archived_check', sql`${table.archived} in (0, 1)`),
    check('suppliers_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
    index('suppliers_display_name_index').on(table.displayName),
  ],
);

export const supplierCreationRequests = sqliteTable(
  'supplier_creation_requests',
  {
    requestId: text('request_id').notNull().primaryKey(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'no action' }),
    supplierId: text('supplier_id')
      .notNull()
      .unique()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    request: text().notNull(),
    result: text().notNull(),
  },
  (table) => [
    check(
      'supplier_creation_requests_id_check',
      sql`${table.requestId} glob '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-4[0-9a-f][0-9a-f][0-9a-f]-[89ab][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'`,
    ),
  ],
);

export const clientAccessAccounts = sqliteTable(
  'client_access_accounts',
  {
    userId: text('user_id')
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('client_access_accounts_client_id_index').on(table.clientId)],
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
    version: integer().notNull().default(1),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('issuer_settings_singleton_check', sql`${table.id} = 1`),
    check('issuer_settings_version_check', sql`${table.version} between 1 and 9007199254740991`),
    check(
      'issuer_settings_fields_check',
      sql`length(trim(${table.displayName})) between 1 and 160 and length(${table.addressLine1}) <= 160 and length(${table.addressLine2}) <= 160 and length(${table.postalCode}) <= 32 and length(${table.city}) <= 120 and length(${table.country}) <= 120 and length(${table.email}) <= 254 and length(${table.phone}) <= 64 and length(${table.registrationNumber}) <= 64 and length(${table.vatNumber}) <= 64`,
    ),
  ],
);

export const companySettings = sqliteTable(
  'company_settings',
  {
    id: integer().notNull().primaryKey(),
    jurisdiction: text().notNull(),
    functionalCurrency: text('functional_currency').notNull(),
    accountingInitialized: integer('accounting_initialized', { mode: 'boolean' })
      .notNull()
      .default(false),
    fiscalYearStartMonth: integer('fiscal_year_start_month').notNull().default(1),
    fiscalYearStartDay: integer('fiscal_year_start_day').notNull().default(1),
    defaultFiscalYearMonths: integer('default_fiscal_year_months').notNull().default(12),
    enabledModules: text('enabled_modules').notNull(),
    retentionYears: integer('retention_years').notNull().default(10),
    version: integer().notNull().default(1),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('company_settings_singleton_check', sql`${table.id} = 1`),
    check('company_settings_jurisdiction_check', sql`${table.jurisdiction} = 'FR'`),
    check(
      'company_settings_currency_check',
      sql`${table.functionalCurrency} glob '[A-Z][A-Z][A-Z]'`,
    ),
    check('company_settings_initialized_check', sql`${table.accountingInitialized} in (0, 1)`),
    check(
      'company_settings_fiscal_start_check',
      sql`${table.fiscalYearStartMonth} between 1 and 12 and ${table.fiscalYearStartDay} between 1 and 31`,
    ),
    check('company_settings_fiscal_months_check', sql`${table.defaultFiscalYearMonths} = 12`),
    check('company_settings_modules_json_check', sql`json_valid(${table.enabledModules})`),
    check('company_settings_retention_check', sql`${table.retentionYears} >= 10`),
    check('company_settings_version_check', sql`${table.version} between 1 and 9007199254740991`),
  ],
);

export const refreshSessions = sqliteTable(
  'refresh_sessions',
  {
    id: text().notNull().primaryKey(),
    familyId: text('family_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHmac: blob('token_hmac', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    rotatedAt: integer('rotated_at', { mode: 'timestamp_ms' }).notNull(),
    absoluteExpiresAt: integer('absolute_expires_at', { mode: 'timestamp_ms' }).notNull(),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
    replacementSessionId: text('replacement_session_id'),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('refresh_sessions_token_hmac_unique').on(table.tokenHmac),
    uniqueIndex('refresh_sessions_replacement_session_id_unique').on(table.replacementSessionId),
    index('refresh_sessions_user_id_index').on(table.userId, table.revokedAt),
    index('refresh_sessions_family_id_index').on(table.familyId, table.revokedAt),
    index('refresh_sessions_expiry_index').on(table.absoluteExpiresAt),
    check(
      'refresh_sessions_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'refresh_sessions_family_id_ulid_check',
      sql`${table.familyId} is not null and length(${table.familyId}) = 26 and ${table.familyId} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.familyId}, 1, 1) between '0' and '7'`,
    ),
    check(
      'refresh_sessions_token_hmac_check',
      sql`typeof(${table.tokenHmac}) = 'blob' and length(${table.tokenHmac}) = 32`,
    ),
    check(
      'refresh_sessions_replacement_session_id_check',
      sql`${table.replacementSessionId} is null or (length(${table.replacementSessionId}) = 26 and ${table.replacementSessionId} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.replacementSessionId}, 1, 1) between '0' and '7')`,
    ),
    check(
      'refresh_sessions_timestamps_check',
      sql`${table.rotatedAt} >= ${table.createdAt} and ${table.absoluteExpiresAt} > ${table.createdAt} and (${table.consumedAt} is null or ${table.consumedAt} >= ${table.createdAt}) and (${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt})`,
    ),
  ],
);

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text().notNull().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'no action' }),
    name: text().notNull(),
    tokenHmac: blob('token_hmac', { mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    revokedByUserId: text('revoked_by_user_id').references(() => users.id, {
      onDelete: 'no action',
    }),
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull(),
  },
  (table) => [
    uniqueIndex('api_tokens_token_hmac_unique').on(table.tokenHmac),
    index('api_tokens_user_id_index').on(table.userId),
    index('api_tokens_expires_at_index').on(table.expiresAt),
    index('api_tokens_active_index').on(table.revokedAt, table.expiresAt),
    index('api_tokens_unrevoked_name_expiry_index')
      .on(table.name, table.expiresAt)
      .where(sql`${table.revokedAt} is null`),
    index('api_tokens_created_at_id_index').on(desc(table.createdAt), desc(table.id)),
    check(
      'api_tokens_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('api_tokens_name_check', sql`length(trim(${table.name})) between 1 and 120`),
    check(
      'api_tokens_token_hmac_check',
      sql`typeof(${table.tokenHmac}) = 'blob' and length(${table.tokenHmac}) = 32`,
    ),
    check('api_tokens_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'api_tokens_timestamps_check',
      sql`(${table.lastUsedAt} is null or ${table.lastUsedAt} >= ${table.createdAt}) and (${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt})`,
    ),
    check(
      'api_tokens_revocation_check',
      sql`(${table.revokedAt} is null and ${table.revokedByUserId} is null) or (${table.revokedAt} is not null and ${table.revokedByUserId} is not null)`,
    ),
    check('api_tokens_rate_limit_check', sql`${table.rateLimitPerMinute} between 1 and 600`),
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

export const customRoles = sqliteTable(
  'custom_roles',
  {
    id: text().notNull().primaryKey(),
    requestId: text('request_id').notNull().unique(),
    name: text().notNull().unique(),
    permissions: text().notNull(),
    version: integer().notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check(
      'custom_roles_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('custom_roles_request_id_check', sql`length(${table.requestId}) = 36`),
    check('custom_roles_name_check', sql`length(trim(${table.name})) between 1 and 80`),
    check('custom_roles_permissions_check', sql`json_valid(${table.permissions})`),
    check('custom_roles_version_check', sql`${table.version} > 0`),
    check('custom_roles_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
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

export const apiTokenPermissions = sqliteTable(
  'api_token_permissions',
  {
    tokenId: text('token_id')
      .notNull()
      .references(() => apiTokens.id, { onDelete: 'no action' }),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permissions.code, { onDelete: 'no action' }),
  },
  (table) => [
    primaryKey({ columns: [table.tokenId, table.permissionCode] }),
    index('api_token_permissions_code_index').on(table.permissionCode),
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
    reference: text().notNull(),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'no action' }),
    status: text({
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'],
    }).notNull(),
    version: integer().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('quotes_client_id_index').on(table.clientId),
    uniqueIndex('quotes_reference_unique').on(table.reference),
    check(
      'quotes_reference_check',
      sql`${table.reference} glob 'DE-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'`,
    ),
    check(
      'quotes_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'quotes_status_check',
      sql`${table.status} in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')`,
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
    conditionsPresentation: text('conditions_presentation'),
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
    check(
      'quote_revisions_conditions_presentation_check',
      sql`${table.conditionsPresentation} is null or json_valid(${table.conditionsPresentation})`,
    ),
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

export const quoteConditionPresets = sqliteTable(
  'quote_condition_presets',
  {
    id: text().notNull().primaryKey(),
    name: text().notNull(),
    conditions: text().notNull(),
    conditionsPresentation: text('conditions_presentation'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('quote_condition_presets_name_unique').on(table.name),
    check(
      'quote_condition_presets_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('quote_condition_presets_name_check', sql`length(trim(${table.name})) between 1 and 120`),
    check(
      'quote_condition_presets_conditions_check',
      sql`length(trim(${table.conditions})) > 0 and length(${table.conditions}) <= 2000`,
    ),
    check(
      'quote_condition_presets_presentation_check',
      sql`${table.conditionsPresentation} is null or json_valid(${table.conditionsPresentation})`,
    ),
    check(
      'quote_condition_presets_timestamps_check',
      sql`${table.updatedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const invoicePayments = sqliteTable(
  'invoice_payments',
  {
    id: text().notNull().primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    requestId: text('request_id').notNull().unique(),
    expectedVersion: integer('expected_version').notNull(),
    amountCents: integer('amount_cents').notNull(),
    paidOn: text('paid_on').notNull(),
    method: text().notNull(),
    reference: text().notNull(),
    recordedAt: text('recorded_at').notNull(),
    cancelledAt: text('cancelled_at'),
    cancelledByUserId: text('cancelled_by_user_id').references(() => users.id),
    cancellationReason: text('cancellation_reason'),
    recordedByUserId: text('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index('invoice_payments_invoice_index').on(table.invoiceId),
    check(
      'invoice_payments_cancellation_check',
      sql`(${table.cancelledAt} is null and ${table.cancelledByUserId} is null and ${table.cancellationReason} is null) or (${table.cancelledAt} is not null and ${table.cancelledByUserId} is not null and ${table.cancellationReason} is not null and length(trim(${table.cancellationReason})) between 1 and 500)`,
    ),
    check(
      'invoice_payments_amount_check',
      sql`${table.amountCents} between 1 and 9007199254740991`,
    ),
    check(
      'invoice_payments_method_check',
      sql`${table.method} in ('transfer', 'card', 'cash', 'cheque', 'other')`,
    ),
    check(
      'invoice_payments_reference_check',
      sql`length(trim(${table.reference})) between 1 and 160`,
    ),
  ],
);

export const catalogItems = sqliteTable(
  'catalog_items',
  {
    id: text().notNull().primaryKey(),
    description: text().notNull(),
    quantityMilli: integer('quantity_milli').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    vatRateBasisPoints: integer('vat_rate_basis_points').notNull(),
    currency: text().notNull(),
    version: integer().notNull(),
    archived: integer({ mode: 'boolean' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    check('catalog_description_check', sql`length(trim(${table.description})) between 1 and 160`),
    check('catalog_quantity_check', sql`${table.quantityMilli} between 1 and 9007199254740991`),
    check('catalog_price_check', sql`${table.unitPriceCents} between 0 and 9007199254740991`),
    check('catalog_tax_check', sql`${table.vatRateBasisPoints} between 0 and 10000`),
    check('catalog_currency_check', sql`${table.currency} = 'EUR'`),
    check('catalog_version_check', sql`${table.version} between 1 and 9007199254740991`),
    check('catalog_archived_check', sql`${table.archived} in (0, 1)`),
    check('catalog_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const documentArtifacts = sqliteTable(
  'document_artifacts',
  {
    id: text().notNull().primaryKey(),
    revisionId: text('revision_id').references(() => quoteRevisions.id, { onDelete: 'cascade' }),
    invoiceRevisionId: text('invoice_revision_id').references(() => invoiceRevisions.id, {
      onDelete: 'no action',
    }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'no action' }),
    kind: text({ enum: ['quote-pdf', 'invoice-pdf', 'order-pdf', 'credit-note-pdf'] }).notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text().notNull(),
    content: blob({ mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('document_artifacts_quote_revision_kind_unique').on(table.revisionId, table.kind),
    uniqueIndex('document_artifacts_invoice_revision_kind_unique').on(
      table.invoiceRevisionId,
      table.kind,
    ),
    uniqueIndex('document_artifacts_order_kind_unique').on(table.orderId, table.kind),
    check(
      'document_artifacts_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'document_artifacts_kind_check',
      sql`(${table.kind} = 'quote-pdf' and ${table.revisionId} is not null and ${table.invoiceRevisionId} is null and ${table.orderId} is null) or (${table.kind} in ('invoice-pdf', 'credit-note-pdf') and ${table.revisionId} is null and ${table.invoiceRevisionId} is not null and ${table.orderId} is null) or (${table.kind} = 'order-pdf' and ${table.revisionId} is null and ${table.invoiceRevisionId} is null and ${table.orderId} is not null)`,
    ),
    check('document_artifacts_content_type_check', sql`${table.contentType} = 'application/pdf'`),
    check(
      'document_artifacts_content_check',
      sql`${table.byteSize} > 0 and ${table.byteSize} = length(${table.content}) and typeof(${table.content}) = 'blob' and length(${table.sha256}) = 64 and ${table.sha256} not glob '*[^a-f0-9]*'`,
    ),
    index('document_artifacts_revision_id_index').on(table.revisionId),
    index('document_artifacts_invoice_revision_id_index').on(table.invoiceRevisionId),
    index('document_artifacts_order_id_index').on(table.orderId),
  ],
);

export const quoteLinks = sqliteTable(
  'quote_links',
  {
    id: text().notNull().primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: 'cascade' }),
    tokenHmac: blob('token_hmac', { mode: 'buffer' }).notNull(),
    usagePolicy: text('usage_policy', { enum: ['single-use'] })
      .notNull()
      .default('single-use'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    consumedAt: integer('consumed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('quote_links_token_hmac_unique').on(table.tokenHmac),
    index('quote_links_revision_id_index').on(table.revisionId),
    check(
      'quote_links_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'quote_links_token_hmac_check',
      sql`typeof(${table.tokenHmac}) = 'blob' and length(${table.tokenHmac}) = 32`,
    ),
    check('quote_links_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
    check('quote_links_usage_policy_check', sql`${table.usagePolicy} = 'single-use'`),
    check(
      'quote_links_terminal_timestamps_check',
      sql`(${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}) and (${table.consumedAt} is null or ${table.consumedAt} >= ${table.createdAt})`,
    ),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text().notNull().primaryKey(),
    action: text().notNull(),
    actorUserId: text('actor_user_id'),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    requestId: text('request_id'),
    traceId: text('trace_id'),
    spanId: text('span_id'),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    metadata: text().notNull(),
  },
  (table) => [
    index('audit_events_occurred_at_id_index').on(table.occurredAt, table.id),
    index('audit_events_actor_user_id_index').on(table.actorUserId),
    index('audit_events_resource_index').on(table.resourceType, table.resourceId),
    index('audit_events_request_id_index').on(table.requestId),
    index('audit_events_trace_id_index').on(table.traceId),
    check(
      'audit_events_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'audit_events_actor_user_id_check',
      sql`${table.actorUserId} is null or (length(${table.actorUserId}) = 26 and ${table.actorUserId} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.actorUserId}, 1, 1) between '0' and '7')`,
    ),
    check(
      'audit_events_action_check',
      sql`length(${table.action}) between 3 and 80 and ${table.action} glob '[a-z]*.[a-z]*' and ${table.action} not glob '*[^a-z.-]*'`,
    ),
    check(
      'audit_events_resource_type_check',
      sql`length(${table.resourceType}) between 1 and 40 and ${table.resourceType} not glob '*[^a-z-]*'`,
    ),
    check(
      'audit_events_resource_id_check',
      sql`length(trim(${table.resourceId})) between 1 and 160`,
    ),
    check(
      'audit_events_request_id_check',
      sql`${table.requestId} is null or (length(${table.requestId}) = 36 and ${table.requestId} glob '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-4[0-9a-f][0-9a-f][0-9a-f]-[89ab][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]')`,
    ),
    check(
      'audit_events_trace_id_check',
      sql`${table.traceId} is null or (length(${table.traceId}) = 32 and ${table.traceId} not glob '*[^0-9a-f]*')`,
    ),
    check(
      'audit_events_span_id_check',
      sql`${table.spanId} is null or (length(${table.spanId}) = 16 and ${table.spanId} not glob '*[^0-9a-f]*')`,
    ),
    check(
      'audit_events_metadata_check',
      sql`json_valid(${table.metadata}) and json_type(${table.metadata}) = 'object' and length(${table.metadata}) <= 4096`,
    ),
  ],
);

export const quoteSignatures = sqliteTable(
  'quote_signatures',
  {
    id: text().notNull().primaryKey(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'no action' }),
    revisionId: text('revision_id')
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: 'no action' }),
    linkId: text('link_id')
      .notNull()
      .references(() => quoteLinks.id, { onDelete: 'no action' }),
    signerName: text('signer_name').notNull(),
    consent: integer({ mode: 'boolean' }).notNull(),
    signatureKind: text('signature_kind', { enum: ['typed'] }).notNull(),
    signatureValue: text('signature_value').notNull(),
    signedAt: integer('signed_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent').notNull(),
    snapshotSha256: text('snapshot_sha256').notNull(),
    pdfSha256: text('pdf_sha256').notNull(),
    auditEventId: text('audit_event_id')
      .notNull()
      .references(() => auditEvents.id, { onDelete: 'no action' }),
    evidenceContent: blob('evidence_content', { mode: 'buffer' }).notNull(),
    evidenceSha256: text('evidence_sha256').notNull(),
  },
  (table) => [
    uniqueIndex('quote_signatures_quote_id_unique').on(table.quoteId),
    uniqueIndex('quote_signatures_revision_id_unique').on(table.revisionId),
    uniqueIndex('quote_signatures_link_id_unique').on(table.linkId),
    uniqueIndex('quote_signatures_audit_event_id_unique').on(table.auditEventId),
    check(
      'quote_signatures_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check(
      'quote_signatures_signer_check',
      sql`length(trim(${table.signerName})) between 1 and 160 and length(trim(${table.signatureValue})) between 1 and 160 and ${table.signatureKind} = 'typed' and ${table.consent} = 1`,
    ),
    check(
      'quote_signatures_context_check',
      sql`length(${table.ipAddress}) between 1 and 64 and length(${table.userAgent}) <= 512`,
    ),
    check(
      'quote_signatures_hashes_check',
      sql`length(${table.snapshotSha256}) = 64 and ${table.snapshotSha256} not glob '*[^a-f0-9]*' and length(${table.pdfSha256}) = 64 and ${table.pdfSha256} not glob '*[^a-f0-9]*' and length(${table.evidenceSha256}) = 64 and ${table.evidenceSha256} not glob '*[^a-f0-9]*'`,
    ),
    check(
      'quote_signatures_evidence_check',
      sql`typeof(${table.evidenceContent}) = 'blob' and length(${table.evidenceContent}) between 1 and 65536`,
    ),
  ],
);

export const orders = sqliteTable(
  'orders',
  {
    id: text().notNull().primaryKey(),
    reference: text().notNull(),
    quoteId: text('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'no action' }),
    revisionId: text('revision_id')
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: 'no action' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'no action' }),
    signatureId: text('signature_id')
      .notNull()
      .references(() => quoteSignatures.id, { onDelete: 'no action' }),
    status: text({ enum: ['confirmed'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('orders_quote_id_unique').on(table.quoteId),
    uniqueIndex('orders_reference_unique').on(table.reference),
    check(
      'orders_reference_check',
      sql`${table.reference} glob 'CO-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'`,
    ),
    uniqueIndex('orders_revision_id_unique').on(table.revisionId),
    uniqueIndex('orders_signature_id_unique').on(table.signatureId),
    index('orders_client_id_index').on(table.clientId),
    check(
      'orders_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('orders_status_check', sql`${table.status} = 'confirmed'`),
  ],
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text().notNull().primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'no action' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'no action' }),
    status: text({ enum: ['draft', 'issued', 'paid', 'void'] }).notNull(),
    version: integer().notNull(),
    invoiceNumber: text('invoice_number'),
    issuedAt: integer('issued_at', { mode: 'timestamp_ms' }),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    voidedAt: integer('voided_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('invoices_order_id_unique').on(table.orderId),
    uniqueIndex('invoices_invoice_number_unique').on(table.invoiceNumber),
    index('invoices_client_id_index').on(table.clientId),
    check(
      'invoices_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('invoices_status_check', sql`${table.status} in ('draft', 'issued', 'paid', 'void')`),
    check('invoices_version_check', sql`${table.version} >= 1`),
    check(
      'invoices_number_state_check',
      sql`(${table.status} = 'draft' and ${table.invoiceNumber} is null and ${table.issuedAt} is null) or (${table.status} in ('issued', 'paid', 'void') and ((length(${table.invoiceNumber}) >= 8 and substr(${table.invoiceNumber}, 1, 2) = 'F-' and substr(${table.invoiceNumber}, 3) not glob '*[^0-9]*') or ${table.invoiceNumber} glob 'FA-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]') and ${table.issuedAt} is not null)`,
    ),
    check(
      'invoices_terminal_state_check',
      sql`(${table.status} = 'paid' and ${table.paidAt} is not null and ${table.voidedAt} is null) or (${table.status} = 'void' and ${table.voidedAt} is not null and ${table.paidAt} is null) or (${table.status} in ('draft', 'issued') and ${table.paidAt} is null and ${table.voidedAt} is null)`,
    ),
    check('invoices_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
  ],
);

export const invoiceCreditNotes = sqliteTable(
  'invoice_credit_notes',
  {
    id: text().primaryKey().notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .unique()
      .references(() => invoices.id),
    invoiceRevisionId: text('invoice_revision_id')
      .notNull()
      .references(() => invoiceRevisions.id),
    requestId: text('request_id').notNull().unique(),
    number: text().notNull().unique(),
    reason: text().notNull(),
    issuedAt: text('issued_at').notNull(),
    issuedByUserId: text('issued_by_user_id')
      .notNull()
      .references(() => users.id),
    netTotalCents: integer('net_total_cents').notNull(),
    vatTotalCents: integer('vat_total_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    expectedVersion: integer('expected_version').notNull(),
  },
  (table) => [
    check(
      'credit_note_amount_check',
      sql`${table.totalCents} > 0 and ${table.totalCents} = ${table.netTotalCents} + ${table.vatTotalCents}`,
    ),
  ],
);

export const invoiceRefunds = sqliteTable(
  'invoice_refunds',
  {
    id: text().primaryKey().notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    requestId: text('request_id').notNull().unique(),
    amountCents: integer('amount_cents').notNull(),
    refundedOn: text('refunded_on').notNull(),
    reference: text().notNull(),
    recordedAt: text('recorded_at').notNull(),
    recordedByUserId: text('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    cancelledAt: text('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    cancelledByUserId: text('cancelled_by_user_id').references(() => users.id),
  },
  (table) => [
    index('invoice_refund_invoice_index').on(table.invoiceId),
    check('invoice_refund_amount_check', sql`${table.amountCents} between 1 and 9007199254740991`),
  ],
);

export const invoiceRevisions = sqliteTable(
  'invoice_revisions',
  {
    id: text().notNull().primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'no action' }),
    version: integer().notNull(),
    invoiceNumber: text('invoice_number'),
    issuedAt: integer('issued_at', { mode: 'timestamp_ms' }),
    clientDisplayName: text('client_display_name').notNull(),
    title: text().notNull(),
    serviceDate: text('service_date').notNull(),
    dueDate: text('due_date').notNull(),
    paymentTerms: text('payment_terms').notNull(),
    paymentTermsPresentation: text('payment_terms_presentation'),
    currency: text({ enum: ['EUR'] }).notNull(),
    netTotalCents: integer('net_total_cents').notNull(),
    vatTotalCents: integer('vat_total_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'no action' }),
    templateId: text('template_id').notNull(),
    templateVersion: integer('template_version').notNull(),
    renderSnapshot: text('render_snapshot').notNull(),
  },
  (table) => [
    uniqueIndex('invoice_revisions_invoice_id_version_unique').on(table.invoiceId, table.version),
    index('invoice_revisions_created_by_user_id_index').on(table.createdByUserId),
    check(
      'invoice_revisions_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('invoice_revisions_version_check', sql`${table.version} >= 1`),
    check(
      'invoice_revisions_number_check',
      sql`(${table.invoiceNumber} is null and ${table.issuedAt} is null) or (((length(${table.invoiceNumber}) >= 8 and substr(${table.invoiceNumber}, 1, 2) = 'F-' and substr(${table.invoiceNumber}, 3) not glob '*[^0-9]*') or ${table.invoiceNumber} glob 'FA-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]') and ${table.issuedAt} is not null)`,
    ),
    check(
      'invoice_revisions_client_display_name_check',
      sql`length(trim(${table.clientDisplayName})) > 0`,
    ),
    check('invoice_revisions_title_check', sql`length(trim(${table.title})) between 1 and 120`),
    check(
      'invoice_revisions_dates_check',
      sql`strftime('%Y-%m-%d', ${table.serviceDate}, '+0 days') = ${table.serviceDate} and strftime('%Y-%m-%d', ${table.dueDate}, '+0 days') = ${table.dueDate} and ${table.dueDate} >= ${table.serviceDate}`,
    ),
    check('invoice_revisions_payment_terms_check', sql`length(${table.paymentTerms}) <= 2000`),
    check(
      'invoice_revisions_payment_terms_presentation_check',
      sql`${table.paymentTermsPresentation} is null or json_valid(${table.paymentTermsPresentation})`,
    ),
    check('invoice_revisions_currency_check', sql`${table.currency} = 'EUR'`),
    check(
      'invoice_revisions_totals_check',
      sql`${table.netTotalCents} between 0 and 9007199254740991 and ${table.vatTotalCents} between 0 and 9007199254740991 and ${table.totalCents} between 0 and 9007199254740991 and ${table.totalCents} = ${table.netTotalCents} + ${table.vatTotalCents}`,
    ),
    check(
      'invoice_revisions_render_check',
      sql`${table.templateId} = 'invoice-default' and ${table.templateVersion} = 1 and json_valid(${table.renderSnapshot})`,
    ),
  ],
);

export const invoiceLines = sqliteTable(
  'invoice_lines',
  {
    id: text().notNull().primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => invoiceRevisions.id, { onDelete: 'no action' }),
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
    uniqueIndex('invoice_lines_revision_id_position_unique').on(table.revisionId, table.position),
    check(
      'invoice_lines_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('invoice_lines_position_check', sql`${table.position} between 0 and 19`),
    check(
      'invoice_lines_description_check',
      sql`length(trim(${table.description})) between 1 and 160`,
    ),
    check(
      'invoice_lines_input_check',
      sql`${table.quantityMilli} between 1 and 9007199254740991 and ${table.unitPriceCents} between 0 and 9007199254740991 and ${table.vatRateBasisPoints} between 0 and 10000`,
    ),
    check(
      'invoice_lines_totals_check',
      sql`${table.netTotalCents} between 0 and 9007199254740991 and ${table.vatTotalCents} between 0 and 9007199254740991 and ${table.totalCents} between 0 and 9007199254740991 and ${table.totalCents} = ${table.netTotalCents} + ${table.vatTotalCents}`,
    ),
  ],
);

export const businessReferenceCounters = sqliteTable(
  'business_reference_counters',
  {
    kind: text({ enum: ['quote', 'order', 'invoice', 'credit-note'] }).notNull(),
    year: integer().notNull(),
    nextValue: integer('next_value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.year] }),
    check(
      'business_reference_counters_kind_check',
      sql`${table.kind} in ('quote', 'order', 'invoice', 'credit-note')`,
    ),
    check('business_reference_counters_year_check', sql`${table.year} between 1 and 9999`),
    check(
      'business_reference_counters_next_value_check',
      sql`${table.nextValue} between 1 and 1000000`,
    ),
  ],
);

export const invoicePdfJobs = sqliteTable(
  'invoice_pdf_jobs',
  {
    invoiceRevisionId: text('invoice_revision_id')
      .notNull()
      .primaryKey()
      .references(() => invoiceRevisions.id, { onDelete: 'no action' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'no action' }),
    invoiceNumber: text('invoice_number').notNull(),
    version: integer().notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'no action' }),
    status: text({ enum: ['pending', 'processing', 'ready', 'failed'] }).notNull(),
    attempts: integer().notNull(),
    error: text(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('invoice_pdf_jobs_invoice_id_unique').on(table.invoiceId),
    index('invoice_pdf_jobs_status_updated_at_index').on(table.status, table.updatedAt),
    check(
      'invoice_pdf_jobs_revision_id_ulid_check',
      sql`${table.invoiceRevisionId} is not null and length(${table.invoiceRevisionId}) = 26 and ${table.invoiceRevisionId} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.invoiceRevisionId}, 1, 1) between '0' and '7'`,
    ),
    check(
      'invoice_pdf_jobs_invoice_id_ulid_check',
      sql`${table.invoiceId} is not null and length(${table.invoiceId}) = 26 and ${table.invoiceId} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.invoiceId}, 1, 1) between '0' and '7'`,
    ),
    check(
      'invoice_pdf_jobs_actor_id_ulid_check',
      sql`${table.actorUserId} is not null and length(${table.actorUserId}) = 26 and ${table.actorUserId} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.actorUserId}, 1, 1) between '0' and '7'`,
    ),
    check(
      'invoice_pdf_jobs_number_check',
      sql`(length(${table.invoiceNumber}) >= 8 and substr(${table.invoiceNumber}, 1, 2) = 'F-' and substr(${table.invoiceNumber}, 3) not glob '*[^0-9]*') or ${table.invoiceNumber} glob 'FA-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'`,
    ),
    check('invoice_pdf_jobs_version_check', sql`${table.version} >= 1`),
    check(
      'invoice_pdf_jobs_status_check',
      sql`${table.status} in ('pending', 'processing', 'ready', 'failed')`,
    ),
    check('invoice_pdf_jobs_attempts_check', sql`${table.attempts} >= 0`),
    check(
      'invoice_pdf_jobs_error_check',
      sql`(${table.status} = 'failed' and ${table.error} = 'pdf.render_failed') or (${table.status} <> 'failed' and ${table.error} is null)`,
    ),
    check('invoice_pdf_jobs_timestamps_check', sql`${table.updatedAt} >= ${table.createdAt}`),
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

export const PasswordCredentialRow = createSelectSchema(passwordCredentials, {
  userId: ulid,
});
export interface PasswordCredentialRow extends Schema.Schema.Type<typeof PasswordCredentialRow> {}

export const RefreshSessionRow = createSelectSchema(refreshSessions, {
  id: ulid,
  familyId: ulid,
  userId: ulid,
});
export interface RefreshSessionRow extends Schema.Schema.Type<typeof RefreshSessionRow> {}

export const PasswordCredentialLookup = Schema.Struct({
  userId: ulid(Schema.String),
  mode: Schema.Literals(['client', 'administrator']),
  passwordHash: Schema.String,
});

export const RefreshSessionLookup = Schema.Struct({
  id: ulid(Schema.String),
  familyId: ulid(Schema.String),
  userId: ulid(Schema.String),
  mode: Schema.Literals(['client', 'administrator']),
  createdAt: Schema.Int,
  absoluteExpiresAt: Schema.Int,
  consumedAt: Schema.NullOr(Schema.Int),
  replacementSessionId: Schema.NullOr(ulid(Schema.String)),
  revokedAt: Schema.NullOr(Schema.Int),
  disabledAt: Schema.NullOr(Schema.Int),
  passwordChangedAt: Schema.Int,
});
export const integrationOperations = sqliteTable('integration_operations', {
  id: text().notNull().primaryKey(),
  requestId: text('request_id').notNull().unique(),
  request: text().notNull(),
  receipt: text(),
  createdAt: text('created_at').notNull(),
  createdByUserId: text('created_by_user_id')
    .notNull()
    .references(() => users.id),
});

export const integrationRetries = sqliteTable(
  'integration_retries',
  {
    operationId: text('operation_id')
      .notNull()
      .primaryKey()
      .references(() => integrationOperations.id),
    attempts: integer().notNull().default(0),
    status: text().notNull().default('waiting'),
    nextAttemptAt: integer('next_attempt_at').notNull(),
    error: text(),
  },
  (table) => [
    index('integration_retries_due_index').on(table.status, table.nextAttemptAt),
    check('integration_retries_attempts_check', sql`${table.attempts} between 0 and 5`),
    check(
      'integration_retries_status_check',
      sql`${table.status} in ('waiting', 'processing', 'completed', 'exhausted', 'blocked')`,
    ),
  ],
);

export const emailReminders = sqliteTable(
  'email_reminders',
  {
    id: text().notNull().primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    request: text().notNull(),
    sendAt: text('send_at').notNull(),
    status: text().notNull().default('scheduled'),
    reason: text(),
    operationId: text('operation_id').references(() => integrationOperations.id),
    preparedVersion: integer('prepared_version'),
    preparedPaidCents: integer('prepared_paid_cents'),
    preparedRecipient: text('prepared_recipient'),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('email_reminders_due_index').on(table.status, table.sendAt),
    uniqueIndex('email_reminders_invoice_pending_index')
      .on(table.invoiceId)
      .where(sql`${table.status} = 'scheduled'`),
    check('email_reminders_request_check', sql`json_valid(${table.request})`),
    check(
      'email_reminders_status_check',
      sql`${table.status} in ('scheduled', 'cancelled', 'skipped', 'queued')`,
    ),
  ],
);

export const emailReminderRejections = sqliteTable(
  'email_reminder_rejections',
  {
    requestId: text('request_id').primaryKey().notNull(),
    request: text().notNull(),
    reason: text().notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    check('email_reminder_rejections_request_check', sql`json_valid(${table.request})`),
    check(
      'email_reminder_rejections_reason_check',
      sql`${table.reason} in ('invoice-ineligible', 'invoice-changed', 'recipient-invalid', 'mode-changed', 'date-invalid', 'already-scheduled', 'limit')`,
    ),
  ],
);

export const bankTransactions = sqliteTable(
  'bank_transactions',
  {
    id: text().notNull().primaryKey(),
    account: text().notNull(),
    reference: text().notNull(),
    bookedOn: text('booked_on').notNull(),
    amountCents: integer('amount_cents').notNull(),
    description: text().notNull(),
    importedAt: text('imported_at').notNull(),
    importedByUserId: text('imported_by_user_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [uniqueIndex('bank_transaction_source_index').on(table.account, table.reference)],
);

export const bankMatches = sqliteTable(
  'bank_matches',
  {
    id: text().notNull().primaryKey(),
    requestId: text('request_id').notNull().unique(),
    amountCents: integer('amount_cents').notNull(),
    feeCents: integer('fee_cents').notNull().default(0),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => bankTransactions.id),
    paymentId: text('payment_id')
      .notNull()
      .references(() => invoicePayments.id),
    matchedAt: text('matched_at').notNull(),
    matchedByUserId: text('matched_by_user_id')
      .notNull()
      .references(() => users.id),
    cancelledAt: text('cancelled_at'),
    cancelledByUserId: text('cancelled_by_user_id').references(() => users.id),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => [
    index('bank_match_transaction_index')
      .on(table.transactionId)
      .where(sql`${table.cancelledAt} is null`),
    index('bank_match_payment_index')
      .on(table.paymentId)
      .where(sql`${table.cancelledAt} is null`),
    check('bank_match_amount_check', sql`${table.amountCents} between 1 and 9007199254740991`),
    check(
      'bank_match_fee_check',
      sql`${table.feeCents} >= 0 and ${table.feeCents} < ${table.amountCents}`,
    ),
  ],
);

export const bankLedgerEntries = sqliteTable(
  'bank_ledger_entries',
  {
    id: text().primaryKey().notNull(),
    requestId: text('request_id').notNull().unique(),
    sourceKind: text('source_kind').notNull(),
    sourceId: text('source_id').notNull(),
    debitAccount: text('debit_account').notNull(),
    creditAccount: text('credit_account').notNull(),
    label: text().notNull(),
    amountCents: integer('amount_cents').notNull(),
    bookedOn: text('booked_on').notNull(),
    recordedAt: text('recorded_at').notNull(),
    recordedByUserId: text('recorded_by_user_id')
      .notNull()
      .references(() => users.id),
    reversesId: text('reverses_id').unique(),
  },
  (table) => [
    index('bank_ledger_source_index').on(table.sourceKind, table.sourceId),
    check('bank_ledger_kind_check', sql`${table.sourceKind} in ('debit', 'fee')`),
    check('bank_ledger_amount_check', sql`${table.amountCents} between 1 and 9007199254740991`),
    check('bank_ledger_accounts_check', sql`${table.debitAccount} <> ${table.creditAccount}`),
  ],
);
export const emailTests = sqliteTable(
  'email_tests',
  {
    accountKey: text('account_key'),
    requestId: text('request_id').notNull().primaryKey(),
    request: text().notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    status: text().notNull(),
    attempts: integer().notNull().default(0),
    lease: integer().notNull().default(0),
    nextAttemptAt: integer('next_attempt_at'),
    providerId: text('provider_id'),
    error: text(),
  },
  (table) => [
    check(
      'email_test_status_check',
      sql`${table.status} in ('queued', 'sending', 'retrying', 'accepted', 'delivered', 'bounced', 'complained', 'failed', 'blocked')`,
    ),
    check('email_test_attempts_check', sql`${table.attempts} between 0 and 5`),
  ],
);

export const checkoutOperations = sqliteTable(
  'checkout_operations',
  {
    requestId: text('request_id').notNull().primaryKey(),
    request: text().notNull(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    revisionId: text('revision_id')
      .notNull()
      .references(() => invoiceRevisions.id),
    invoiceNumber: text('invoice_number').notNull(),
    amountCents: integer('amount_cents').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    returnUrl: text('return_url').notNull(),
    accountKey: text('account_key'),
    status: text().notNull(),
    attempts: integer().notNull().default(0),
    lease: integer().notNull().default(0),
    nextAttemptAt: integer('next_attempt_at'),
    sessionId: text('session_id').unique(),
    checkoutUrl: text('checkout_url'),
    error: text(),
  },
  (table) => [
    check(
      'checkout_status_check',
      sql`${table.status} in ('queued','creating','retrying','open','paid','expired','failed','blocked')`,
    ),
    check('checkout_attempts_check', sql`${table.attempts} between 0 and 5`),
    check('checkout_amount_check', sql`${table.amountCents} between 50 and 99999999`),
    index('checkout_due_index').on(table.nextAttemptAt),
    uniqueIndex('checkout_active_invoice_unique')
      .on(table.invoiceId)
      .where(sql`${table.status} in ('queued','creating','retrying','open')`),
  ],
);

export const checkoutEvents = sqliteTable('checkout_events', {
  eventId: text('event_id').notNull().primaryKey(),
  requestId: text('request_id')
    .notNull()
    .references(() => checkoutOperations.requestId),
  eventType: text('event_type').notNull(),
  receivedAt: integer('received_at').notNull(),
});
