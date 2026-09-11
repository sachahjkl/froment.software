import { InvoiceRenderSnapshot } from '@froment/contracts';
import { Effect, Layer, Schema } from 'effect';
import { join } from 'node:path';
import { ulid } from 'ulid';
import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';

export const integrationTestTime = 1788955200000;
export const integrationDatabaseLayer = () =>
  AuditLive.pipe(
    Layer.provideMerge(
      makeMigratedDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '../../drizzle'),
      }),
    ),
  );

export const seedIntegrationInvoice = Effect.fn('IntegrationTest.seedInvoice')(function* () {
  const { sqlite } = yield* Database;
  const actorId = ulid();
  const clientId = ulid();
  const quoteId = ulid();
  const quoteRevisionId = ulid();
  const linkId = ulid();
  const signatureId = ulid();
  const auditId = ulid();
  const orderId = ulid();
  const invoiceId = ulid();
  const revisionId = ulid();
  const roleId = ulid();
  const number = String(
    Schema.decodeUnknownSync(Schema.Int)(
      sqlite.prepare('select count(*) from invoices').pluck().get(),
    ) + 1,
  ).padStart(6, '0');
  const snapshot = Schema.decodeUnknownSync(InvoiceRenderSnapshot)({
    templateId: 'invoice-default',
    templateVersion: 1,
    invoiceId,
    orderId,
    orderReference: `CO-2026-${number}`,
    quoteReference: `DE-2026-${number}`,
    revisionId,
    version: 1,
    createdAt: new Date(integrationTestTime).toISOString(),
    invoiceNumber: `FA-2026-${number}`,
    issuedAt: new Date(integrationTestTime).toISOString(),
    serviceDate: '2026-09-01',
    dueDate: '2026-10-01',
    issuer: {
      displayName: 'Issuer',
      addressLine1: '1 rue du Test',
      addressLine2: '',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      email: 'issuer@example.test',
      phone: '',
      registrationNumber: '',
      vatNumber: '',
    },
    client: {
      displayName: 'Client',
      addressLine1: '2 rue du Test',
      addressLine2: '',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      email: 'client@example.test',
    },
    title: 'Invoice',
    paymentTerms: '30 days',
    currency: 'EUR',
    netTotalCents: 10000,
    vatTotalCents: 2000,
    totalCents: 12000,
    lines: [
      {
        id: ulid(),
        position: 0,
        description: 'Service',
        quantityMilli: 1000,
        unitPriceCents: 10000,
        vatRateBasisPoints: 2000,
        netTotalCents: 10000,
        vatTotalCents: 2000,
        totalCents: 12000,
      },
    ],
  });
  sqlite
    .transaction(() => {
      sqlite
        .prepare(`insert into users (id, display_name, kind, created_at, updated_at)
      values (?, 'Administrator', 'administrator', ?, ?), (?, 'Client', 'client', ?, ?)`)
        .run(
          actorId,
          integrationTestTime,
          integrationTestTime,
          clientId,
          integrationTestTime,
          integrationTestTime,
        );
      sqlite
        .prepare('insert into roles (id, name, created_at) values (?, ?, ?)')
        .run(roleId, `Integration test ${number}`, integrationTestTime);
      for (const code of [
        'integration.configure',
        'integration.manage',
        'invoice.read',
        'client.read',
        'email.reminder.manage',
      ])
        sqlite
          .prepare('insert into role_permissions (role_id, permission_code) values (?, ?)')
          .run(roleId, code);
      sqlite
        .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
        .run(actorId, roleId);
      sqlite
        .prepare(`insert into clients (id, created_at, updated_at, address_line_1, address_line_2, postal_code, city, country, email)
      values (?, ?, ?, '2 rue du Test', '', '75001', 'Paris', 'France', 'client@example.test')`)
        .run(clientId, integrationTestTime, integrationTestTime);
      sqlite
        .prepare(`insert into quotes (id, reference, client_id, status, version, created_at, updated_at)
      values (?, ?, ?, 'accepted', 1, ?, ?)`)
        .run(quoteId, snapshot.quoteReference, clientId, integrationTestTime, integrationTestTime);
      sqlite
        .prepare(`insert into quote_revisions (id, quote_id, version, client_display_name, title, conditions, currency,
      net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id)
      values (?, ?, 1, 'Client', 'Quote', '', 'EUR', 10000, 2000, 12000, ?, ?)`)
        .run(quoteRevisionId, quoteId, integrationTestTime, actorId);
      sqlite
        .prepare(`insert into quote_links (id, revision_id, token_hmac, usage_policy, created_at, expires_at, consumed_at)
      values (?, ?, ?, 'single-use', ?, ?, ?)`)
        .run(
          linkId,
          quoteRevisionId,
          Buffer.from(linkId.padEnd(32, '0')),
          integrationTestTime,
          integrationTestTime + 1000,
          integrationTestTime,
        );
      sqlite
        .prepare(`insert into audit_events (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
      values (?, 'quote.accepted', null, 'quote', ?, ?, '{}')`)
        .run(auditId, quoteId, integrationTestTime);
      sqlite
        .prepare(`insert into quote_signatures (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind,
      signature_value, signed_at, ip_address, user_agent, snapshot_sha256, pdf_sha256, audit_event_id, evidence_content, evidence_sha256)
      values (?, ?, ?, ?, 'Client', 1, 'typed', 'Client', ?, '127.0.0.1', '', ?, ?, ?, ?, ?)`)
        .run(
          signatureId,
          quoteId,
          quoteRevisionId,
          linkId,
          integrationTestTime,
          'a'.repeat(64),
          'b'.repeat(64),
          auditId,
          Buffer.from('test evidence'),
          'c'.repeat(64),
        );
      sqlite
        .prepare(`insert into orders (id, reference, quote_id, revision_id, client_id, signature_id, status, created_at)
      values (?, ?, ?, ?, ?, ?, 'confirmed', ?)`)
        .run(
          orderId,
          snapshot.orderReference,
          quoteId,
          quoteRevisionId,
          clientId,
          signatureId,
          integrationTestTime,
        );
      sqlite
        .prepare(`insert into invoices (id, order_id, client_id, status, version, invoice_number, issued_at, created_at, updated_at)
      values (?, ?, ?, 'issued', 1, ?, ?, ?, ?)`)
        .run(
          invoiceId,
          orderId,
          clientId,
          snapshot.invoiceNumber,
          integrationTestTime,
          integrationTestTime,
          integrationTestTime,
        );
      sqlite
        .prepare(`insert into invoice_revisions (id, invoice_id, version, invoice_number, issued_at, client_display_name, title,
      service_date, due_date, payment_terms, currency, net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id,
      template_id, template_version, render_snapshot)
      values (?, ?, 1, ?, ?, 'Client', 'Invoice', '2026-09-01', '2026-10-01', '30 days', 'EUR', 10000, 2000, 12000, ?, ?, 'invoice-default', 1, ?)`)
        .run(
          revisionId,
          invoiceId,
          snapshot.invoiceNumber,
          integrationTestTime,
          integrationTestTime,
          actorId,
          JSON.stringify(snapshot),
        );
      for (const line of snapshot.lines)
        sqlite
          .prepare(`insert into invoice_lines (id, revision_id, position, description, quantity_milli, unit_price_cents,
        vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
        values (?, ?, 0, 'Service', 1000, 10000, 2000, 10000, 2000, 12000)`)
          .run(line.id, revisionId);
    })
    .immediate();
  return { actorId, clientId, invoiceId, revisionId, roleId, snapshot };
});
