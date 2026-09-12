import {
  DemoAccountingEntryCount,
  DemoAffairCount,
  DemoBankTransactionCount,
  DemoClientCount,
  DemoQuoteCount,
  DemoResetRejected,
  DemoSupplierCount,
  DemoSupplierInvoiceCount,
  PermissionCodes,
  TeamProfilePermissions,
  Ulid,
  type DemoResetResult,
  type DemoResetRequest,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Option, Redacted, Schema } from 'effect';
import { Audit } from '../audit/audit.js';
import { Passwords } from '../authentication/password.js';
import { Database, DatabaseError } from '../database/database.js';
import { RuntimeConfiguration } from '../runtime-config.js';
import { createHash, timingSafeEqual } from 'node:crypto';

/* oxlint-disable anti-slop/no-natural-language-literals -- Deterministic fixture content, not application interface prose. */

const DAY_MILLISECONDS = 86_400_000;
const EXCHANGE_RATE_SCALE = 1_000_000_000;
const VAT_RATE_BASIS_POINTS = 2_000;
const MONEY_NET_CENTS = 10_000;
const MONEY_VAT_CENTS = 2_000;
const MONEY_TOTAL_CENTS = MONEY_NET_CENTS + MONEY_VAT_CENTS;
const ID_PREFIX = '01HF7YAT00';
const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ResetTrigger = Schema.Struct({ name: Schema.String, sql: Schema.String });
const ResetTable = Schema.Struct({ name: Schema.String });

const deterministicId = (index: number): UlidValue => {
  let remaining = index;
  let suffix = '';
  while (suffix.length < 16) {
    suffix = `${ID_ALPHABET[remaining % ID_ALPHABET.length]}${suffix}`;
    remaining = Math.floor(remaining / ID_ALPHABET.length);
  }
  return Schema.decodeUnknownSync(Ulid)(`${ID_PREFIX}${suffix}`);
};
const requestId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const dateAt = (now: number, dayOffset: number) =>
  new Date(now + dayOffset * DAY_MILLISECONDS).toISOString().slice(0, 10);
const quoteStatus = (index: number) => {
  const statuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'] as const;
  return statuses[index % statuses.length] ?? 'draft';
};
const supplierInvoiceStatus = (index: number) => {
  const statuses = ['draft', 'confirmed', 'approved', 'paid', 'cancelled'] as const;
  return statuses[index % statuses.length] ?? 'draft';
};
const accountingEntryStatus = (index: number) => {
  const statuses = ['draft', 'posted', 'reversed'] as const;
  return statuses[index % statuses.length] ?? 'draft';
};
const demoCurrency = (index: number, divisor: number) => {
  if (index % divisor === 0) return 'USD' as const;
  return 'EUR' as const;
};
const affairStatus = (index: number) => {
  if (index % 5 === 0) return 'closed' as const;
  return 'open' as const;
};
const supplierConfirmation = (
  status: ReturnType<typeof supplierInvoiceStatus>,
  now: number,
  invoiceDate: string,
) => {
  if (status === 'draft')
    return {
      confirmedAt: null,
      approvedAt: null,
      functionalCurrency: null,
      exchangeRateDate: null,
      exchangeRate: null,
      functionalNet: null,
      functionalVat: null,
      functionalTotal: null,
    };
  let approvedAt: number | null = null;
  if (status === 'approved' || status === 'paid') approvedAt = now;
  return {
    confirmedAt: now,
    approvedAt,
    functionalCurrency: 'EUR',
    exchangeRateDate: invoiceDate,
    exchangeRate: EXCHANGE_RATE_SCALE,
    functionalNet: MONEY_NET_CENTS,
    functionalVat: MONEY_VAT_CENTS,
    functionalTotal: MONEY_TOTAL_CENTS,
  };
};
const postingMetadata = (
  status: ReturnType<typeof accountingEntryStatus>,
  now: number,
  actor: UlidValue,
) => {
  if (status === 'draft') return { postedAt: null, postedBy: null };
  return { postedAt: now, postedBy: actor };
};

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const runtime = yield* RuntimeConfiguration;
  const passwords = yield* Passwords;
  const audit = yield* Audit;

  const reset = Effect.fn('Demo.reset')(function* (
    request: DemoResetRequest,
    actorUserId: UlidValue,
  ) {
    if (runtime.application.appEnvironment !== 'staging')
      return yield* new DemoResetRejected({ code: 'demo.environment_rejected' });
    const password = Option.getOrUndefined(runtime.demo.password);
    if (password === undefined)
      return yield* new DemoResetRejected({ code: 'demo.secret_missing' });
    const provided = Buffer.from(request.password);
    const expected = Buffer.from(Redacted.value(password));
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
      return yield* new DemoResetRejected({ code: 'demo.password_invalid' });
    const passwordHash = yield* passwords.hash(Redacted.value(password)).pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    const result = yield* Effect.try({
      try: () => {
        sqlite.pragma('foreign_keys = OFF');
        try {
          return sqlite
            .transaction(() => {
              const triggers = Schema.decodeUnknownSync(Schema.Array(ResetTrigger))(
                sqlite
                  .prepare(
                    "select name, sql from sqlite_master where type = 'trigger' and sql is not null",
                  )
                  .all(),
              );
              for (const trigger of triggers)
                sqlite.exec(`drop trigger "${trigger.name.replaceAll('"', '""')}"`);
              const tables = Schema.decodeUnknownSync(Schema.Array(ResetTable))(
                sqlite
                  .prepare(
                    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name <> '__drizzle_migrations'",
                  )
                  .all(),
              );
              for (const table of tables)
                sqlite.exec(`delete from "${table.name.replaceAll('"', '""')}"`);

              const administratorId = deterministicId(1);
              const profiles = [
                {
                  id: administratorId,
                  name: 'Demo Administrator',
                  email: 'administrator@demo.invalid',
                  profile: null,
                },
                {
                  id: deterministicId(2),
                  name: 'Demo Collaborator',
                  email: 'collaborator@demo.invalid',
                  profile: 'collaborator',
                },
                {
                  id: deterministicId(3),
                  name: 'Demo Accountant',
                  email: 'accountant@demo.invalid',
                  profile: 'accountant',
                },
                {
                  id: deterministicId(4),
                  name: 'Demo Accounting Validator',
                  email: 'validator@demo.invalid',
                  profile: 'accounting-validator',
                },
                {
                  id: deterministicId(5),
                  name: 'Demo Accounting Reader',
                  email: 'reader@demo.invalid',
                  profile: 'accounting-reader',
                },
              ] as const;
              const insertUser = sqlite.prepare(
                "insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, 'administrator', ?, ?)",
              );
              const insertCredential = sqlite.prepare(
                'insert into password_credentials (user_id, email, password_hash, created_at, updated_at, password_changed_at) values (?, ?, ?, ?, ?, ?)',
              );
              for (const profile of profiles) {
                insertUser.run(profile.id, profile.name, now, now);
                insertCredential.run(profile.id, profile.email, passwordHash, now, now, now);
                const roleId = deterministicId(100 + profiles.indexOf(profile));
                sqlite
                  .prepare('insert into roles (id, name, created_at) values (?, ?, ?)')
                  .run(roleId, `demo-${profile.email}`, now);
                sqlite
                  .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
                  .run(profile.id, roleId);
                let permissions: ReadonlyArray<(typeof PermissionCodes)[number]> = PermissionCodes;
                if (profile.profile !== null) permissions = TeamProfilePermissions[profile.profile];
                for (const permission of permissions)
                  sqlite
                    .prepare(
                      'insert into role_permissions (role_id, permission_code) values (?, ?)',
                    )
                    .run(roleId, permission);
                if (profile.profile !== null)
                  sqlite
                    .prepare(
                      'insert into team_members (user_id, profile, version) values (?, ?, 1)',
                    )
                    .run(profile.id, profile.profile);
              }
              for (const permission of PermissionCodes)
                sqlite.prepare('insert into permissions (code) values (?)').run(permission);

              sqlite
                .prepare(
                  'insert into company_settings (id, jurisdiction, functional_currency, accounting_initialized, fiscal_year_start_month, fiscal_year_start_day, default_fiscal_year_months, enabled_modules, retention_years, version, updated_at) values (1, \'FR\', \'EUR\', 1, 1, 1, 12, \'["sales","purchasing","banking","accounting","tax","ai","demonstration"]\', 10, 1, ?)',
                )
                .run(now);
              sqlite
                .prepare(
                  "insert into issuer_settings (id, display_name, address_line_1, address_line_2, postal_code, city, country, email, phone, registration_number, vat_number, iban, bic, version, updated_at) values (1, 'Froment Démonstration', '1 rue de la Démonstration', '', '75001', 'Paris', 'France', 'contact@demo.invalid', '+33100000000', '00000000000000', 'FR00000000000', 'FR7630006000011234567890189', 'AGRIFRPP', 1, ?)",
                )
                .run(now);
              sqlite
                .prepare(
                  "insert into supplier_invoice_analysis_settings (id, adapter) values (1, 'local')",
                )
                .run();
              sqlite
                .prepare(
                  "insert into accounting_tax_filing_settings (id, adapter) values (1, 'local')",
                )
                .run();

              const insertClientUser = sqlite.prepare(
                "insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, 'client', ?, ?)",
              );
              const insertClient = sqlite.prepare(
                "insert into clients (id, created_at, updated_at, address_line_1, postal_code, city, country, email, phone) values (?, ?, ?, ?, ?, ?, 'France', ?, ?)",
              );
              for (let index = 0; index < DemoClientCount; index += 1) {
                const id = deterministicId(1_000 + index);
                const number = index + 1;
                insertClientUser.run(id, `Client démonstration ${number}`, now, now);
                insertClient.run(
                  id,
                  now,
                  now,
                  `${number} rue des Clients`,
                  `75${String(number).padStart(3, '0')}`,
                  'Paris',
                  `client${number}@demo.invalid`,
                  `+331${String(number).padStart(8, '0')}`,
                );
              }
              const insertSupplier = sqlite.prepare(
                "insert into suppliers (id, display_name, address_line_1, postal_code, city, country, email, phone, registration_number, vat_number, default_currency, payment_terms_days, iban, bic, archived, created_at, updated_at) values (?, ?, ?, '69001', 'Lyon', 'France', ?, '+33400000000', ?, ?, ?, 30, 'FR7630006000011234567890189', 'AGRIFRPP', ?, ?, ?)",
              );
              for (let index = 0; index < DemoSupplierCount; index += 1) {
                const number = index + 1;
                const currency = demoCurrency(index, 5);
                insertSupplier.run(
                  deterministicId(2_000 + index),
                  `Fournisseur démonstration ${number}`,
                  `${number} avenue des Fournisseurs`,
                  `supplier${number}@demo.invalid`,
                  `SIREN${String(number).padStart(9, '0')}`,
                  `FR${String(number).padStart(11, '0')}`,
                  currency,
                  Number(index % 11 === 0),
                  now,
                  now,
                );
                const taxTreatments = [
                  ['france', 'France'],
                  ['eu-reverse-charge', 'Allemagne'],
                  ['non-eu-import', 'États-Unis'],
                  ['foreign-local-tax', 'Canada'],
                ] as const;
                const [taxTreatment, country] =
                  taxTreatments[index % taxTreatments.length] ?? taxTreatments[0];
                sqlite
                  .prepare(
                    'update suppliers set tax_treatment = ?, country = ?, vies_validated_at = ? where id = ?',
                  )
                  .run(
                    taxTreatment,
                    country,
                    taxTreatment === 'eu-reverse-charge' ? now : null,
                    deterministicId(2_000 + index),
                  );
              }
              const year = new Date(now).getUTCFullYear();
              const isoNow = DateTime.formatIso(DateTime.makeUnsafe(now));
              const issuer = {
                displayName: 'Froment Démonstration',
                addressLine1: '1 rue de la Démonstration',
                addressLine2: '',
                postalCode: '75001',
                city: 'Paris',
                country: 'France',
                email: 'contact@demo.invalid',
                phone: '+33100000000',
                registrationNumber: '00000000000000',
                vatNumber: 'FR00000000000',
              };
              const clientParty = (index: number) => ({
                displayName: `Client démonstration ${index + 1}`,
                addressLine1: `${index + 1} rue des Clients`,
                addressLine2: '',
                postalCode: `75${String(index + 1).padStart(3, '0')}`,
                city: 'Paris',
                country: 'France',
                email: `client${index + 1}@demo.invalid`,
                phone: `+331${String(index + 1).padStart(8, '0')}`,
              });
              const insertAffair = sqlite.prepare(
                'insert into affairs (id, request_id, reference, client_id, title, status, version, created_at, updated_at) values (?, ?, ?, ?, ?, ?, 1, ?, ?)',
              );
              for (let index = 0; index < DemoAffairCount; index += 1)
                insertAffair.run(
                  deterministicId(3_000 + index),
                  requestId(3_000 + index),
                  `AF-${year}-${String(index + 1).padStart(6, '0')}`,
                  deterministicId(1_000 + (index % DemoClientCount)),
                  `Affaire démonstration ${index + 1}`,
                  affairStatus(index),
                  now,
                  now,
                );

              const insertQuote = sqlite.prepare(
                'insert into quotes (id, reference, client_id, status, version, created_at, updated_at) values (?, ?, ?, ?, 1, ?, ?)',
              );
              const insertQuoteRevision = sqlite.prepare(
                "insert into quote_revisions (id, quote_id, version, client_display_name, title, conditions, currency, net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id) values (?, ?, 1, ?, ?, '', ?, ?, ?, ?, ?, ?)",
              );
              const insertQuoteLine = sqlite.prepare(
                'insert into quote_lines (id, revision_id, position, description, quantity_milli, unit_price_cents, vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents) values (?, ?, 0, ?, 1000, ?, ?, ?, ?, ?)',
              );
              const insertQuoteRevisionTwo = sqlite.prepare(
                "insert into quote_revisions (id, quote_id, version, client_display_name, title, conditions, currency, net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id) values (?, ?, 2, ?, ?, '', ?, ?, ?, ?, ?, ?)",
              );
              const pdfContent = Buffer.from('%PDF-1.4\n%%EOF');
              const pdfSha256 = createHash('sha256').update(pdfContent).digest('hex');
              for (let index = 0; index < DemoQuoteCount; index += 1) {
                const id = deterministicId(4_000 + index);
                const revisionId = deterministicId(5_000 + index);
                const clientIndex = index % DemoClientCount;
                const currency = demoCurrency(index, 7);
                insertQuote.run(
                  id,
                  `DE-${year}-${String(index + 1).padStart(6, '0')}`,
                  deterministicId(1_000 + clientIndex),
                  quoteStatus(index),
                  now,
                  now,
                );
                insertQuoteRevision.run(
                  revisionId,
                  id,
                  `Client démonstration ${clientIndex + 1}`,
                  `Projet démonstration ${index + 1}`,
                  currency,
                  MONEY_NET_CENTS,
                  MONEY_VAT_CENTS,
                  MONEY_TOTAL_CENTS,
                  now,
                  administratorId,
                );
                insertQuoteLine.run(
                  deterministicId(6_000 + index),
                  revisionId,
                  `Prestation démonstration ${index + 1}`,
                  MONEY_NET_CENTS,
                  VAT_RATE_BASIS_POINTS,
                  MONEY_NET_CENTS,
                  MONEY_VAT_CENTS,
                  MONEY_TOTAL_CENTS,
                );
                if (index % 10 === 0) {
                  const revisedId = deterministicId(16_000 + index);
                  insertQuoteRevisionTwo.run(
                    revisedId,
                    id,
                    `Client démonstration ${clientIndex + 1}`,
                    `Projet démonstration ${index + 1} — version 2`,
                    currency,
                    MONEY_NET_CENTS,
                    MONEY_VAT_CENTS,
                    MONEY_TOTAL_CENTS,
                    now,
                    administratorId,
                  );
                  insertQuoteLine.run(
                    deterministicId(17_000 + index),
                    revisedId,
                    `Prestation révisée ${index + 1}`,
                    MONEY_NET_CENTS,
                    VAT_RATE_BASIS_POINTS,
                    MONEY_NET_CENTS,
                    MONEY_VAT_CENTS,
                    MONEY_TOTAL_CENTS,
                  );
                  sqlite.prepare('update quotes set version = 2 where id = ?').run(id);
                }
                if (quoteStatus(index) !== 'draft') {
                  const version = index % 10 === 0 ? 2 : 1;
                  const currentRevisionId =
                    version === 2 ? deterministicId(16_000 + index) : revisionId;
                  const currentLineId =
                    version === 2
                      ? deterministicId(17_000 + index)
                      : deterministicId(6_000 + index);
                  const title =
                    version === 2
                      ? `Projet démonstration ${index + 1} — version 2`
                      : `Projet démonstration ${index + 1}`;
                  const description =
                    version === 2
                      ? `Prestation révisée ${index + 1}`
                      : `Prestation démonstration ${index + 1}`;
                  const snapshot = {
                    templateId: 'quote-default',
                    templateVersion: 1,
                    calendar: { timeZone: 'Europe/Paris' },
                    quoteId: id,
                    quoteReference: `DE-${year}-${String(index + 1).padStart(6, '0')}`,
                    revisionId: currentRevisionId,
                    version,
                    createdAt: isoNow,
                    issuer,
                    client: clientParty(clientIndex),
                    title,
                    conditions: '',
                    currency,
                    netTotalCents: MONEY_NET_CENTS,
                    vatTotalCents: MONEY_VAT_CENTS,
                    totalCents: MONEY_TOTAL_CENTS,
                    lines: [
                      {
                        id: currentLineId,
                        position: 0,
                        description,
                        quantityMilli: 1_000,
                        unitPriceCents: MONEY_NET_CENTS,
                        vatRateBasisPoints: VAT_RATE_BASIS_POINTS,
                        netTotalCents: MONEY_NET_CENTS,
                        vatTotalCents: MONEY_VAT_CENTS,
                        totalCents: MONEY_TOTAL_CENTS,
                      },
                    ],
                  };
                  sqlite
                    .prepare(
                      "update quote_revisions set template_id = 'quote-default', template_version = 1, render_snapshot = ? where id = ?",
                    )
                    .run(JSON.stringify(snapshot), currentRevisionId);
                  sqlite
                    .prepare(
                      "insert into document_artifacts (id, revision_id, kind, content_type, byte_size, sha256, content, created_at) values (?, ?, 'quote-pdf', 'application/pdf', ?, ?, ?, ?)",
                    )
                    .run(
                      deterministicId(32_000 + index),
                      currentRevisionId,
                      pdfContent.length,
                      pdfSha256,
                      pdfContent,
                      now,
                    );
                }
                sqlite
                  .prepare(
                    'insert into affair_quotes (affair_id, quote_id, linked_at, linked_by_user_id) values (?, ?, ?, ?)',
                  )
                  .run(
                    deterministicId(3_000 + (index % DemoAffairCount)),
                    id,
                    now,
                    administratorId,
                  );
              }

              const evidenceContent = Buffer.from('{}');
              const evidenceSha256 = createHash('sha256').update(evidenceContent).digest('hex');
              const debtInvoices: Array<{ invoiceId: UlidValue; clientId: UlidValue }> = [];
              const targetInvoices = new Map<string, UlidValue>();
              let acceptedIndex = 0;
              for (let quoteIndex = 0; quoteIndex < DemoQuoteCount; quoteIndex += 1) {
                if (quoteStatus(quoteIndex) !== 'accepted') continue;
                const quoteId = deterministicId(4_000 + quoteIndex);
                const quoteVersion = quoteIndex % 10 === 0 ? 2 : 1;
                const quoteRevisionId =
                  quoteVersion === 2
                    ? deterministicId(16_000 + quoteIndex)
                    : deterministicId(5_000 + quoteIndex);
                const quoteLineId =
                  quoteVersion === 2
                    ? deterministicId(17_000 + quoteIndex)
                    : deterministicId(6_000 + quoteIndex);
                const clientIndex = quoteIndex % DemoClientCount;
                const clientId = deterministicId(1_000 + clientIndex);
                const currency = demoCurrency(quoteIndex, 7);
                const quoteReference = `DE-${year}-${String(quoteIndex + 1).padStart(6, '0')}`;
                const quoteTitle =
                  quoteVersion === 2
                    ? `Projet démonstration ${quoteIndex + 1} — version 2`
                    : `Projet démonstration ${quoteIndex + 1}`;
                const quoteLineDescription =
                  quoteVersion === 2
                    ? `Prestation révisée ${quoteIndex + 1}`
                    : `Prestation démonstration ${quoteIndex + 1}`;
                const quoteSnapshot = {
                  templateId: 'quote-default',
                  templateVersion: 1,
                  calendar: { timeZone: 'Europe/Paris' },
                  quoteId,
                  quoteReference,
                  revisionId: quoteRevisionId,
                  version: quoteVersion,
                  createdAt: isoNow,
                  issuer,
                  client: clientParty(clientIndex),
                  title: quoteTitle,
                  conditions: '',
                  currency,
                  netTotalCents: MONEY_NET_CENTS,
                  vatTotalCents: MONEY_VAT_CENTS,
                  totalCents: MONEY_TOTAL_CENTS,
                  lines: [
                    {
                      id: quoteLineId,
                      position: 0,
                      description: quoteLineDescription,
                      quantityMilli: 1_000,
                      unitPriceCents: MONEY_NET_CENTS,
                      vatRateBasisPoints: VAT_RATE_BASIS_POINTS,
                      netTotalCents: MONEY_NET_CENTS,
                      vatTotalCents: MONEY_VAT_CENTS,
                      totalCents: MONEY_TOTAL_CENTS,
                    },
                  ],
                };
                sqlite
                  .prepare(
                    "update quote_revisions set template_id = 'quote-default', template_version = 1, render_snapshot = ? where id = ?",
                  )
                  .run(JSON.stringify(quoteSnapshot), quoteRevisionId);
                const linkId = deterministicId(18_000 + acceptedIndex);
                sqlite
                  .prepare(
                    "insert into quote_links (id, revision_id, token_hmac, usage_policy, created_at, expires_at, consumed_at) values (?, ?, ?, 'single-use', ?, ?, ?)",
                  )
                  .run(
                    linkId,
                    quoteRevisionId,
                    Buffer.alloc(32, acceptedIndex + 1),
                    now,
                    now + DAY_MILLISECONDS,
                    now,
                  );
                const acceptanceAuditId = deterministicId(19_000 + acceptedIndex);
                sqlite
                  .prepare(
                    "insert into audit_events (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata) values (?, 'quote.accepted', ?, 'quote', ?, ?, '{}')",
                  )
                  .run(acceptanceAuditId, administratorId, quoteId, now);
                const signatureId = deterministicId(20_000 + acceptedIndex);
                sqlite
                  .prepare(
                    "insert into quote_signatures (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind, signature_value, signed_at, ip_address, user_agent, snapshot_sha256, pdf_sha256, audit_event_id, evidence_content, evidence_sha256) values (?, ?, ?, ?, ?, 1, 'typed', ?, ?, '127.0.0.1', 'demo-reset', ?, ?, ?, ?, ?)",
                  )
                  .run(
                    signatureId,
                    quoteId,
                    quoteRevisionId,
                    linkId,
                    `Client démonstration ${clientIndex + 1}`,
                    `Client démonstration ${clientIndex + 1}`,
                    now,
                    createHash('sha256').update(JSON.stringify(quoteSnapshot)).digest('hex'),
                    pdfSha256,
                    acceptanceAuditId,
                    evidenceContent,
                    evidenceSha256,
                  );
                const orderId = deterministicId(21_000 + acceptedIndex);
                const orderReference = `CO-${year}-${String(acceptedIndex + 1).padStart(6, '0')}`;
                sqlite
                  .prepare(
                    "insert into orders (id, reference, quote_id, revision_id, client_id, signature_id, status, created_at) values (?, ?, ?, ?, ?, ?, 'confirmed', ?)",
                  )
                  .run(
                    orderId,
                    orderReference,
                    quoteId,
                    quoteRevisionId,
                    clientId,
                    signatureId,
                    now,
                  );
                const invoiceId = deterministicId(22_000 + acceptedIndex);
                const invoiceRevisionId = deterministicId(23_000 + acceptedIndex);
                const invoiceLineId = deterministicId(24_000 + acceptedIndex);
                const invoiceStatuses = ['draft', 'issued', 'paid', 'void'] as const;
                const invoiceStatus =
                  invoiceStatuses[acceptedIndex % invoiceStatuses.length] ?? 'draft';
                const issuedAt = invoiceStatus === 'draft' ? null : now;
                const invoiceNumber =
                  invoiceStatus === 'draft'
                    ? null
                    : `FA-${year}-${String(acceptedIndex + 1).padStart(6, '0')}`;
                const paidAt = invoiceStatus === 'paid' ? now : null;
                const voidedAt = invoiceStatus === 'void' ? now : null;
                sqlite
                  .prepare(
                    'insert into invoices (id, order_id, client_id, status, version, invoice_number, issued_at, paid_at, voided_at, created_at, updated_at) values (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)',
                  )
                  .run(
                    invoiceId,
                    orderId,
                    clientId,
                    invoiceStatus,
                    invoiceNumber,
                    issuedAt,
                    paidAt,
                    voidedAt,
                    now,
                    now,
                  );
                const serviceDate = dateAt(now, -45 + (acceptedIndex % 30));
                const dueDate = dateAt(now, -15 + (acceptedIndex % 45));
                const invoiceSnapshot = {
                  templateId: 'invoice-default',
                  templateVersion: 1,
                  calendar: { timeZone: 'Europe/Paris' },
                  invoiceId,
                  orderId,
                  quoteReference,
                  orderReference,
                  revisionId: invoiceRevisionId,
                  version: 1,
                  createdAt: isoNow,
                  invoiceNumber,
                  issuedAt: issuedAt === null ? null : isoNow,
                  serviceDate,
                  dueDate,
                  issuer,
                  client: clientParty(clientIndex),
                  title: quoteTitle,
                  paymentTerms: 'Paiement à 30 jours',
                  currency,
                  netTotalCents: MONEY_NET_CENTS,
                  vatTotalCents: MONEY_VAT_CENTS,
                  totalCents: MONEY_TOTAL_CENTS,
                  lines: [
                    {
                      id: invoiceLineId,
                      position: 0,
                      description: `Prestation facturée ${acceptedIndex + 1}`,
                      quantityMilli: 1_000,
                      unitPriceCents: MONEY_NET_CENTS,
                      vatRateBasisPoints: VAT_RATE_BASIS_POINTS,
                      netTotalCents: MONEY_NET_CENTS,
                      vatTotalCents: MONEY_VAT_CENTS,
                      totalCents: MONEY_TOTAL_CENTS,
                    },
                  ],
                };
                sqlite
                  .prepare(
                    `insert into invoice_revisions
                     (id, invoice_id, version, invoice_number, issued_at, client_display_name, title,
                      service_date, due_date, payment_terms, currency, net_total_cents, vat_total_cents,
                      total_cents, functional_currency, exchange_rate_date,
                      foreign_units_per_functional_unit_nanos, functional_net_total_cents,
                      functional_vat_total_cents, functional_total_cents, created_at, created_by_user_id,
                      template_id, template_version, render_snapshot)
                     values (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'invoice-default', 1, ?)`,
                  )
                  .run(
                    invoiceRevisionId,
                    invoiceId,
                    invoiceNumber,
                    issuedAt,
                    `Client démonstration ${clientIndex + 1}`,
                    quoteTitle,
                    serviceDate,
                    dueDate,
                    'Paiement à 30 jours',
                    currency,
                    MONEY_NET_CENTS,
                    MONEY_VAT_CENTS,
                    MONEY_TOTAL_CENTS,
                    issuedAt === null ? null : 'EUR',
                    issuedAt === null ? null : serviceDate,
                    issuedAt === null ? null : EXCHANGE_RATE_SCALE,
                    issuedAt === null ? null : MONEY_NET_CENTS,
                    issuedAt === null ? null : MONEY_VAT_CENTS,
                    issuedAt === null ? null : MONEY_TOTAL_CENTS,
                    now,
                    administratorId,
                    JSON.stringify(invoiceSnapshot),
                  );
                sqlite
                  .prepare(
                    'insert into invoice_lines (id, revision_id, position, description, quantity_milli, unit_price_cents, vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents) values (?, ?, 0, ?, 1000, ?, ?, ?, ?, ?)',
                  )
                  .run(
                    invoiceLineId,
                    invoiceRevisionId,
                    `Prestation facturée ${acceptedIndex + 1}`,
                    MONEY_NET_CENTS,
                    VAT_RATE_BASIS_POINTS,
                    MONEY_NET_CENTS,
                    MONEY_VAT_CENTS,
                    MONEY_TOTAL_CENTS,
                  );
                if (issuedAt !== null) {
                  sqlite
                    .prepare(
                      "insert into document_artifacts (id, invoice_revision_id, kind, content_type, byte_size, sha256, content, created_at) values (?, ?, 'invoice-pdf', 'application/pdf', ?, ?, ?, ?)",
                    )
                    .run(
                      deterministicId(25_000 + acceptedIndex),
                      invoiceRevisionId,
                      pdfContent.length,
                      pdfSha256,
                      pdfContent,
                      now,
                    );
                }
                if (invoiceStatus === 'paid' || invoiceStatus === 'issued') {
                  const paymentAmount =
                    invoiceStatus === 'paid' ? MONEY_TOTAL_CENTS : MONEY_TOTAL_CENTS / 2;
                  sqlite
                    .prepare(
                      "insert into invoice_payments (id, invoice_id, request_id, expected_version, amount_cents, paid_on, method, reference, recorded_at, recorded_by_user_id) values (?, ?, ?, 1, ?, ?, 'transfer', ?, ?, ?)",
                    )
                    .run(
                      deterministicId(26_000 + acceptedIndex),
                      invoiceId,
                      requestId(26_000 + acceptedIndex),
                      paymentAmount,
                      serviceDate,
                      `VIR-${acceptedIndex + 1}`,
                      isoNow,
                      administratorId,
                    );
                }
                if (invoiceStatus === 'issued') targetInvoices.set(clientId, invoiceId);
                if (invoiceStatus === 'paid') {
                  const creditId = deterministicId(27_000 + acceptedIndex);
                  const creditRevisionId = deterministicId(28_000 + acceptedIndex);
                  const creditNumber = `AV-${year}-${String(acceptedIndex + 1).padStart(6, '0')}`;
                  sqlite
                    .prepare(
                      "insert into invoice_credit_notes (id, client_id, request_id, issue_request_id, status, version, number, reason, currency, created_at, created_by_user_id, issued_at, issued_by_user_id, net_total_cents, vat_total_cents, total_cents) values (?, ?, ?, ?, 'issued', 1, ?, 'Geste commercial', ?, ?, ?, ?, ?, ?, ?, ?)",
                    )
                    .run(
                      creditId,
                      clientId,
                      requestId(27_000 + acceptedIndex),
                      requestId(28_000 + acceptedIndex),
                      creditNumber,
                      currency,
                      isoNow,
                      administratorId,
                      isoNow,
                      administratorId,
                      MONEY_NET_CENTS / 2,
                      MONEY_VAT_CENTS / 2,
                      MONEY_TOTAL_CENTS / 2,
                    );
                  sqlite
                    .prepare(
                      'insert into invoice_credit_note_revisions (id, credit_note_id, version, reason, created_at, created_by_user_id, net_total_cents, vat_total_cents, total_cents) values (?, ?, 1, ?, ?, ?, ?, ?, ?)',
                    )
                    .run(
                      creditRevisionId,
                      creditId,
                      'Geste commercial',
                      isoNow,
                      administratorId,
                      MONEY_NET_CENTS / 2,
                      MONEY_VAT_CENTS / 2,
                      MONEY_TOTAL_CENTS / 2,
                    );
                  sqlite
                    .prepare(
                      'insert into invoice_credit_note_lines (id, credit_note_id, credit_note_revision_id, invoice_id, invoice_revision_id, invoice_version, invoice_number, source_line_id, position, description, quantity_milli, unit_price_cents, vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents) values (?, ?, ?, ?, ?, 1, ?, ?, 0, ?, 500, ?, ?, ?, ?, ?)',
                    )
                    .run(
                      deterministicId(29_000 + acceptedIndex),
                      creditId,
                      creditRevisionId,
                      invoiceId,
                      invoiceRevisionId,
                      invoiceNumber,
                      invoiceLineId,
                      `Avoir démonstration ${acceptedIndex + 1}`,
                      MONEY_NET_CENTS,
                      VAT_RATE_BASIS_POINTS,
                      MONEY_NET_CENTS / 2,
                      MONEY_VAT_CENTS / 2,
                      MONEY_TOTAL_CENTS / 2,
                    );
                  debtInvoices.push({ invoiceId, clientId });
                }
                acceptedIndex += 1;
              }
              for (const [index, debt] of debtInvoices.entries()) {
                const targetInvoiceId = targetInvoices.get(debt.clientId);
                if (index % 2 === 0 || targetInvoiceId === undefined) {
                  sqlite
                    .prepare(
                      'insert into invoice_refunds (id, invoice_id, request_id, amount_cents, refunded_on, reference, recorded_at, recorded_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?)',
                    )
                    .run(
                      deterministicId(30_000 + index),
                      debt.invoiceId,
                      requestId(30_000 + index),
                      MONEY_TOTAL_CENTS / 2,
                      dateAt(now, 0),
                      `REM-${index + 1}`,
                      isoNow,
                      administratorId,
                    );
                } else {
                  sqlite
                    .prepare(
                      'insert into invoice_credit_allocations (id, request_id, source_invoice_id, target_invoice_id, amount_cents, allocated_on, reference, recorded_at, recorded_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    )
                    .run(
                      deterministicId(31_000 + index),
                      requestId(31_000 + index),
                      debt.invoiceId,
                      targetInvoiceId,
                      MONEY_TOTAL_CENTS / 2,
                      dateAt(now, 0),
                      `IMP-${index + 1}`,
                      isoNow,
                      administratorId,
                    );
                  sqlite
                    .prepare(
                      "update invoices set status = 'paid', paid_at = ?, updated_at = ? where id = ?",
                    )
                    .run(now, now, targetInvoiceId);
                }
              }

              const insertSupplierInvoice = sqlite.prepare(
                "insert into supplier_invoices (id, request_id, request, supplier_id, document_kind, source_invoice_id, tax_treatment, reference, invoice_date, due_date, currency, notes, net_total_cents, vat_total_cents, total_cents, functional_currency, exchange_rate_date, foreign_units_per_functional_unit_nanos, functional_net_total_cents, functional_vat_total_cents, functional_total_cents, status, source, confirmed_at, approved_at, version, created_by_user_id, created_at, updated_at) values (?, ?, '{}', ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, 1, ?, ?, ?)",
              );
              const insertSupplierLine = sqlite.prepare(
                'insert into supplier_invoice_lines (id, invoice_id, position, description, net_total_cents, vat_rate_basis_points, vat_total_cents, total_cents) values (?, ?, 0, ?, ?, ?, ?, ?)',
              );
              for (let index = 0; index < DemoSupplierInvoiceCount; index += 1) {
                const id = deterministicId(7_000 + index);
                const status = supplierInvoiceStatus(index);
                const invoiceDate = dateAt(now, index - 90);
                const currency = demoCurrency(index, 6);
                const confirmation = supplierConfirmation(status, now, invoiceDate);
                const credit = index % 10 === 9;
                const taxTreatments = [
                  'france',
                  'eu-reverse-charge',
                  'non-eu-import',
                  'foreign-local-tax',
                ] as const;
                const taxTreatment = taxTreatments[(index % DemoSupplierCount) % 4] ?? 'france';
                const reverseCharge =
                  taxTreatment === 'eu-reverse-charge' || taxTreatment === 'non-eu-import';
                const supplierTotalCents = reverseCharge ? MONEY_NET_CENTS : MONEY_TOTAL_CENTS;
                insertSupplierInvoice.run(
                  id,
                  requestId(7_000 + index),
                  deterministicId(2_000 + (index % DemoSupplierCount)),
                  credit ? 'credit' : 'invoice',
                  credit ? deterministicId(7_000 + index - 1) : null,
                  taxTreatment,
                  `${credit ? 'AVF' : 'FOUR'}-${String(index + 1).padStart(5, '0')}`,
                  invoiceDate,
                  dateAt(now, index - 60),
                  currency,
                  MONEY_NET_CENTS,
                  MONEY_VAT_CENTS,
                  supplierTotalCents,
                  confirmation.functionalCurrency,
                  confirmation.exchangeRateDate,
                  confirmation.exchangeRate,
                  confirmation.functionalNet,
                  confirmation.functionalVat,
                  confirmation.functionalTotal === null ? null : supplierTotalCents,
                  status,
                  confirmation.confirmedAt,
                  confirmation.approvedAt,
                  administratorId,
                  now,
                  now,
                );
                insertSupplierLine.run(
                  deterministicId(8_000 + index),
                  id,
                  `Achat démonstration ${index + 1}`,
                  MONEY_NET_CENTS,
                  VAT_RATE_BASIS_POINTS,
                  MONEY_VAT_CENTS,
                  supplierTotalCents,
                );
              }
              const supplierEvidenceContent = Buffer.from('supplier invoice evidence');
              sqlite
                .prepare(
                  'insert into supplier_invoice_evidence (id, invoice_id, file_name, media_type, size, sha256, content, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  deterministicId(33_000),
                  deterministicId(7_000),
                  'facture-fournisseur.pdf',
                  'application/pdf',
                  supplierEvidenceContent.length,
                  createHash('sha256').update(supplierEvidenceContent).digest('hex'),
                  supplierEvidenceContent,
                  now,
                  administratorId,
                );
              const importedAt = DateTime.formatIso(DateTime.makeUnsafe(now));
              const insertBank = sqlite.prepare(
                'insert into bank_transactions (id, account, reference, booked_on, amount_cents, currency, functional_currency, exchange_rate_date, foreign_units_per_functional_unit_nanos, functional_amount_cents, description, imported_at, imported_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              );
              for (let index = 0; index < DemoBankTransactionCount; index += 1) {
                let direction = 1;
                if (index % 3 === 0) direction = -1;
                const bookedOn = dateAt(now, index - 120);
                const amount = direction * (5_000 + index * 10);
                insertBank.run(
                  deterministicId(9_000 + index),
                  'DEMO-BANK-EUR',
                  `BANK-${String(index + 1).padStart(6, '0')}`,
                  bookedOn,
                  amount,
                  'EUR',
                  'EUR',
                  bookedOn,
                  EXCHANGE_RATE_SCALE,
                  amount,
                  `Opération bancaire démonstration ${index + 1}`,
                  importedAt,
                  administratorId,
                );
              }
              sqlite
                .prepare(
                  'insert into bank_matches (id, request_id, amount_cents, fee_cents, exchange_difference_functional_cents, transaction_id, payment_id, matched_at, matched_by_user_id) values (?, ?, ?, ?, 0, ?, ?, ?, ?)',
                )
                .run(
                  deterministicId(34_000),
                  requestId(34_000),
                  5_000,
                  10,
                  deterministicId(9_001),
                  deterministicId(26_001),
                  importedAt,
                  administratorId,
                );
              sqlite
                .prepare(
                  'insert into bank_matches (id, request_id, amount_cents, fee_cents, exchange_difference_functional_cents, transaction_id, payment_id, matched_at, matched_by_user_id, cancelled_at, cancelled_by_user_id, cancellation_reason) values (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  deterministicId(34_001),
                  requestId(34_001),
                  5_000,
                  deterministicId(9_002),
                  deterministicId(26_002),
                  importedAt,
                  administratorId,
                  importedAt,
                  administratorId,
                  'Correction de démonstration',
                );

              const paymentBatchId = deterministicId(9_500);
              const paymentInvoiceId = deterministicId(7_002);
              sqlite
                .prepare(
                  "insert into supplier_payment_batches (id, request_id, request, message_id, execution_date, transaction_count, control_sum_cents, content, created_by_user_id, created_at) values (?, ?, '{}', ?, ?, 1, ?, ?, ?, ?)",
                )
                .run(
                  paymentBatchId,
                  requestId(9_500),
                  `FRO-${paymentBatchId}`,
                  dateAt(now, -30),
                  MONEY_NET_CENTS,
                  Buffer.from('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03"/>'),
                  administratorId,
                  now,
                );
              sqlite
                .prepare(
                  'insert into supplier_payment_batch_items (batch_id, invoice_id, amount_cents) values (?, ?, ?)',
                )
                .run(paymentBatchId, paymentInvoiceId, MONEY_NET_CENTS);
              sqlite
                .prepare(
                  'insert into supplier_bank_matches (id, request_id, transaction_id, batch_id, invoice_id, amount_cents, matched_at, matched_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  deterministicId(9_501),
                  requestId(9_501),
                  deterministicId(9_000),
                  paymentBatchId,
                  paymentInvoiceId,
                  5_000,
                  importedAt,
                  administratorId,
                );

              for (let dayOffset = 0; dayOffset < 90; dayOffset += 1) {
                const rateDate = dateAt(now, -dayOffset);
                sqlite
                  .prepare(
                    "insert into exchange_rates (id, functional_currency, foreign_currency, rate_date, foreign_units_per_functional_unit_nanos, source, imported_at, created_by_user_id) values (?, 'EUR', 'USD', ?, ?, 'ecb', ?, ?)",
                  )
                  .run(
                    deterministicId(15_000 + dayOffset),
                    rateDate,
                    EXCHANGE_RATE_SCALE,
                    now,
                    administratorId,
                  );
              }

              const periodId = deterministicId(10_000);
              sqlite
                .prepare(
                  "insert into accounting_periods (id, label, starts_on, ends_on, status, final_closed, version, created_at, updated_at) values (?, ?, ?, ?, 'open', 0, 1, ?, ?)",
                )
                .run(periodId, `Exercice ${year}`, `${year}-01-01`, `${year}-12-31`, now, now);
              const historicalPeriods = [
                ['locked', 1, 0],
                ['closed', 2, 0],
                ['closed', 3, 1],
              ] as const;
              for (const [status, yearOffset, finalClosed] of historicalPeriods) {
                const historicalYear = year - yearOffset;
                sqlite
                  .prepare(
                    'insert into accounting_periods (id, label, starts_on, ends_on, status, final_closed, version, created_at, updated_at) values (?, ?, ?, ?, ?, ?, 1, ?, ?)',
                  )
                  .run(
                    deterministicId(10_000 + yearOffset),
                    `Exercice ${historicalYear}`,
                    `${historicalYear}-01-01`,
                    `${historicalYear}-12-31`,
                    status,
                    finalClosed,
                    now,
                    now,
                  );
              }
              const systemAccounts = [
                ['101', 'Capital', 'equity'],
                ['120', 'Résultat de l’exercice', 'equity'],
                ['129', 'Résultat de l’exercice — perte', 'equity'],
                ['401', 'Fournisseurs', 'liability'],
                ['411', 'Clients', 'asset'],
                ['44566', 'TVA déductible', 'asset'],
                ['44571', 'TVA collectée', 'liability'],
                ['512', 'Banque', 'asset'],
                ['606', 'Achats non stockés', 'expense'],
                ['607', 'Achats de marchandises', 'expense'],
                ['627', 'Services bancaires', 'expense'],
                ['706', 'Prestations de services', 'income'],
                ['707', 'Ventes de marchandises', 'income'],
                ['758', 'Produits divers', 'income'],
                ['768', 'Autres produits financiers', 'income'],
                ['668', 'Autres charges financières', 'expense'],
                ['4452', 'TVA due intracommunautaire', 'liability'],
                ['44551', 'TVA à décaisser', 'liability'],
              ] as const;
              for (const [index, account] of systemAccounts.entries())
                sqlite
                  .prepare(
                    'insert into accounting_accounts (id, code, label, kind, system, archived, version, created_at, updated_at) values (?, ?, ?, ?, 1, 0, 1, ?, ?)',
                  )
                  .run(deterministicId(11_000 + index), ...account, now, now);
              const systemJournals = [
                ['VE', 'Ventes', 'sales'],
                ['AC', 'Achats', 'purchases'],
                ['BQ', 'Banque', 'bank'],
                ['OD', 'Opérations diverses', 'general'],
                ['AN', 'À nouveaux', 'opening'],
              ] as const;
              for (const [index, journal] of systemJournals.entries())
                sqlite
                  .prepare(
                    'insert into accounting_journals (id, code, label, kind, archived, version, created_at, updated_at) values (?, ?, ?, ?, 0, 1, ?, ?)',
                  )
                  .run(deterministicId(12_000 + index), ...journal, now, now);
              for (let index = 0; index < DemoAccountingEntryCount; index += 1) {
                const id = deterministicId(13_000 + index);
                const status = accountingEntryStatus(index);
                const posting = postingMetadata(status, now, administratorId);
                sqlite
                  .prepare(
                    'insert into accounting_entries (id, request_id, journal_id, period_id, entry_date, reference, description, currency, status, version, created_at, created_by_user_id, posted_at, posted_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
                  )
                  .run(
                    id,
                    requestId(13_000 + index),
                    deterministicId(12_003),
                    periodId,
                    dateAt(now, index - 24),
                    `OD-${index + 1}`,
                    `Écriture démonstration ${index + 1}`,
                    'EUR',
                    status,
                    now,
                    administratorId,
                    posting.postedAt,
                    posting.postedBy,
                  );
                sqlite
                  .prepare(
                    'insert into accounting_entry_lines (id, entry_id, position, account_id, label, debit_cents, credit_cents) values (?, ?, 0, ?, ?, ?, 0), (?, ?, 1, ?, ?, 0, ?)',
                  )
                  .run(
                    deterministicId(14_000 + index * 2),
                    id,
                    deterministicId(11_007),
                    'Banque',
                    MONEY_TOTAL_CENTS,
                    deterministicId(14_001 + index * 2),
                    id,
                    deterministicId(11_010),
                    'Produit',
                    MONEY_TOTAL_CENTS,
                  );
              }
              const accountingEvidenceContent = Buffer.from('accounting evidence');
              sqlite
                .prepare(
                  'insert into accounting_evidence (id, entry_id, file_name, media_type, size, sha256, content, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  deterministicId(35_000),
                  deterministicId(13_001),
                  'justificatif-comptable.pdf',
                  'application/pdf',
                  accountingEvidenceContent.length,
                  createHash('sha256').update(accountingEvidenceContent).digest('hex'),
                  accountingEvidenceContent,
                  now,
                  administratorId,
                );
              for (const trigger of triggers) sqlite.exec(trigger.sql);
              const summary: DemoResetResult = {
                clients: DemoClientCount,
                suppliers: DemoSupplierCount,
                affairs: DemoAffairCount,
                quotes: DemoQuoteCount,
                supplierInvoices: DemoSupplierInvoiceCount,
                bankTransactions: DemoBankTransactionCount,
                accountingEntries: DemoAccountingEntryCount,
              };
              audit.insert({
                action: 'demo.reset',
                actorUserId: administratorId,
                resourceType: 'demo',
                resourceId: 'staging',
                metadata: { requestedBy: actorUserId },
                occurredAt: now,
              });
              return summary;
            })
            .immediate();
        } finally {
          sqlite.pragma('foreign_keys = ON');
        }
      },
      catch: (cause) => new DatabaseError({ operation: 'demo.reset', cause }),
    });
    return result;
  });
  return { reset };
});

export class Demo extends Context.Service<Demo, Effect.Success<typeof make>>()(
  '@froment/api/Demo',
) {}
export const DemoLive = Layer.effect(Demo, make);
