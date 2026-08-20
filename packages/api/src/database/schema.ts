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

export const documentArtifacts = sqliteTable(
  'document_artifacts',
  {
    id: text().notNull().primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => quoteRevisions.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['quote-pdf'] }).notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text().notNull(),
    content: blob({ mode: 'buffer' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('document_artifacts_revision_kind_unique').on(table.revisionId, table.kind),
    check(
      'document_artifacts_id_ulid_check',
      sql`${table.id} is not null and length(${table.id}) = 26 and ${table.id} not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(${table.id}, 1, 1) between '0' and '7'`,
    ),
    check('document_artifacts_kind_check', sql`${table.kind} = 'quote-pdf'`),
    check('document_artifacts_content_type_check', sql`${table.contentType} = 'application/pdf'`),
    check(
      'document_artifacts_content_check',
      sql`${table.byteSize} > 0 and ${table.byteSize} = length(${table.content}) and typeof(${table.content}) = 'blob' and length(${table.sha256}) = 64 and ${table.sha256} not glob '*[^a-f0-9]*'`,
    ),
    index('document_artifacts_revision_id_index').on(table.revisionId),
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
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    metadata: text().notNull(),
  },
  (table) => [
    index('audit_events_occurred_at_id_index').on(table.occurredAt, table.id),
    index('audit_events_actor_user_id_index').on(table.actorUserId),
    index('audit_events_resource_index').on(table.resourceType, table.resourceId),
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
