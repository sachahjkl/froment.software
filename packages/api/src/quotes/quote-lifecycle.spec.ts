import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { DateTime, Effect, Layer, Schema } from 'effect';
import { prepareOrderDocument } from '@froment/documents';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { PasswordsLive } from '../authentication/password.js';
import { Clients, ClientsLive } from '../clients/clients.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { RuntimeConfigurationDefaults } from '../runtime-config.js';
import { IssuerSettingsLive } from '../issuer-settings/service.js';
import { QuoteLinks, QuoteLinksLive } from '../quote-links/service.js';
import { Quotes, QuotesLive } from './quotes.js';
import { Orders, OrdersLive } from '../orders/orders.js';
import { CurrentOrderConfirmationEvidence } from '../orders/confirmation-evidence.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const clientId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAC';
const revisionId = '01ARZ3NDEKTSV4RRFFQ69G5FAD';
const lineId = '01ARZ3NDEKTSV4RRFFQ69G5FAE';
const artifactId = '01ARZ3NDEKTSV4RRFFQ69G5FAF';
const linkId = '01ARZ3NDEKTSV4RRFFQ69G5FAG';
const secondLinkId = '01ARZ3NDEKTSV4RRFFQ69G5FAH';
const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const secondToken = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const quoteLinkHmacKey = Buffer.alloc(32, 3);
const createdAt = 1_000;
const expiresAt = 2_000;

const configLayer = Layer.succeed(
  AuthenticationConfig,
  AuthenticationConfig.of({
    bootstrapPasswordHash: {
      cost: 16_384,
      blockSize: 8,
      parallelization: 1,
      salt: Buffer.alloc(16),
      hash: Buffer.alloc(64),
    },
    pasetoSecretKey:
      'k4.secret.NXrAOzhnhDuDrGPrMHzfIwwJi88ZgKI4L4x6DaXjp2ycuz4ubSc_ZLzoQlOEnp-gDMpdjFgTwp0mHG8LP2QuFA',
    pasetoPublicKey: 'k4.public.nLs-Lm0nP2S86EJThJ6foAzKXYxYE8KdJhxvCz9kLhQ',
    apiTokenHmacKey: Buffer.alloc(32, 4),
    refreshHmacKey: Buffer.alloc(32, 2),
    quoteLinkHmacKey,
    publicOrigin: 'https://example.test',
  }),
);
const businessConfigLayer = Layer.succeed(
  BusinessConfig,
  BusinessConfig.of({ timeZone: DateTime.zoneMakeNamedUnsafe('Europe/Paris') }),
);

const databaseLayer = () =>
  makeMigratedDatabaseLayer({
    filename: ':memory:',
    migrationsFolder: join(import.meta.dirname, '../..', 'drizzle'),
  });

const lifecycleLayer = () => {
  const quoteCore = QuotesLive.pipe(Layer.provideMerge(IssuerSettingsLive));
  return Layer.mergeAll(quoteCore, QuoteLinksLive, ClientsLive, OrdersLive).pipe(
    Layer.provide(AuditLive),
    Layer.provide(PasswordsLive),
    Layer.provide(configLayer),
    Layer.provide(RuntimeConfigurationDefaults),
    Layer.provide(businessConfigLayer),
    Layer.provideMerge(databaseLayer()),
  );
};

const seedSentQuote = Effect.fn('seedSentQuote')(function* (
  expiration = expiresAt,
  conditions = '',
) {
  const database = yield* Database;
  const pdf = Buffer.from('%PDF-test');
  const snapshot = {
    templateId: 'quote-default',
    templateVersion: 1,
    quoteId,
    quoteReference: 'DE-2026-000001',
    revisionId,
    version: 1,
    createdAt: '1970-01-01T00:00:01.000Z',
    issuer: {
      displayName: 'Issuer',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
      phone: '',
      registrationNumber: '',
      vatNumber: '',
    },
    client: {
      displayName: 'Client',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
    },
    title: 'Quote',
    conditions,
    currency: 'EUR',
    netTotalCents: 100,
    vatTotalCents: 20,
    totalCents: 120,
    lines: [
      {
        id: lineId,
        position: 0,
        description: 'Service',
        quantityMilli: 1_000,
        unitPriceCents: 100,
        vatRateBasisPoints: 2_000,
        netTotalCents: 100,
        vatTotalCents: 20,
        totalCents: 120,
      },
    ],
  };

  yield* Effect.sync(() => {
    database.sqlite
      .prepare(
        `insert into users (id, display_name, kind, created_at, updated_at)
         values (?, 'Administrator', 'administrator', ?, ?), (?, 'Client', 'client', ?, ?)`,
      )
      .run(actorId, createdAt, createdAt, clientId, createdAt, createdAt);
    database.sqlite
      .prepare(
        `insert into clients
         (id, created_at, updated_at, address_line_1, address_line_2, postal_code, city, country, email)
         values (?, ?, ?, '', '', '', '', '', '')`,
      )
      .run(clientId, createdAt, createdAt);
    database.sqlite
      .prepare(
        `insert into quotes (id, reference, client_id, status, version, created_at, updated_at)
         values (?, 'DE-1970-000001', ?, 'sent', 1, ?, ?)`,
      )
      .run(quoteId, clientId, createdAt, createdAt);
    database.sqlite
      .prepare(
        `insert into quote_revisions
         (id, quote_id, version, client_display_name, title, conditions, currency,
          net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id,
          template_id, template_version, render_snapshot)
          values (?, ?, 1, 'Client', 'Quote', ?, 'EUR', 100, 20, 120, ?, ?,
                 'quote-default', 1, ?)`,
      )
      .run(revisionId, quoteId, conditions, createdAt, actorId, JSON.stringify(snapshot));
    database.sqlite
      .prepare(
        `insert into quote_lines
         (id, revision_id, position, description, quantity_milli, unit_price_cents,
          vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
         values (?, ?, 0, 'Service', 1000, 100, 2000, 100, 20, 120)`,
      )
      .run(lineId, revisionId);
    database.sqlite
      .prepare(
        `insert into document_artifacts
         (id, revision_id, kind, content_type, byte_size, sha256, content, created_at)
         values (?, ?, 'quote-pdf', 'application/pdf', ?, ?, ?, ?)`,
      )
      .run(
        artifactId,
        revisionId,
        pdf.byteLength,
        createHash('sha256').update(pdf).digest('hex'),
        pdf,
        createdAt,
      );
    database.sqlite
      .prepare(
        `insert into quote_links (id, revision_id, token_hmac, created_at, expires_at)
         values (?, ?, ?, ?, ?)`,
      )
      .run(linkId, revisionId, hmac(quoteLinkHmacKey, token), createdAt, expiration);
  });
});

const signatureRequest = {
  token,
  signerName: 'Ada Lovelace',
  consent: true as const,
  signature: { kind: 'typed' as const, value: 'Ada Lovelace' },
};
const publicContext = { ipAddress: '127.0.0.1', userAgent: 'test' };

describe('quote lifecycle', () => {
  it('reports stored PDF availability without changing snapshots or generating documents', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(createdAt + 100);
        const quotes = yield* Quotes;
        const orders = yield* Orders;
        const database = yield* Database;
        const accepted = yield* (yield* QuoteLinks).accept(signatureRequest, publicContext);
        const before = yield* orders.getSnapshot(accepted.orderId);
        expect((yield* quotes.get(quoteId)).currentRevision.pdfAvailable).toBe(true);
        expect(yield* orders.list).toMatchObject([{ id: accepted.orderId, pdfAvailable: false }]);
        const pdf = Buffer.from('%PDF-stored-order');
        database.sqlite
          .prepare(
            `insert into document_artifacts (id, order_id, kind, content_type, byte_size, sha256, content, created_at)
           values (?, ?, 'order-pdf', 'application/pdf', ?, ?, ?, ?)`,
          )
          .run(
            secondLinkId,
            accepted.orderId,
            pdf.byteLength,
            createHash('sha256').update(pdf).digest('hex'),
            pdf,
            createdAt + 100,
          );
        expect(yield* orders.list).toMatchObject([{ id: accepted.orderId, pdfAvailable: true }]);
        expect(yield* orders.getSnapshot(accepted.orderId)).toEqual(before);
        expect(
          database.sqlite.prepare('select count(*) from document_artifacts').pluck().get(),
        ).toBe(2);
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );
  });
  it('freezes the confirmation calendar when accepting an old quote after local midnight', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const instant = DateTime.toEpochMillis(DateTime.makeUnsafe('2026-12-31T23:30:00.000Z'));
        const conditions = 'Conditions historiques\n\nPaiement à réception.';
        yield* seedSentQuote(instant + 60_000, conditions);
        yield* TestClock.setTime(instant);
        const database = yield* Database;
        const quotes = yield* Quotes;
        const links = yield* QuoteLinks;
        const orders = yield* Orders;
        const oldQuote = yield* quotes.getSnapshot(quoteId, 1);
        expect(oldQuote.calendar).toBeUndefined();
        const readOriginal = () =>
          database.sqlite
            .prepare(
              `select r.render_snapshot, a.content, a.sha256 from quote_revisions r
           join document_artifacts a on a.revision_id = r.id where r.id = ?`,
            )
            .get(revisionId);
        const original = readOriginal();
        const accepted = yield* links.accept(signatureRequest, publicContext);
        const snapshot = yield* orders.getSnapshot(accepted.orderId);
        expect(snapshot.calendar).toEqual({ timeZone: 'Europe/Paris' });
        expect(snapshot.orderReference).toBe('CO-2027-000001');
        expect(snapshot.conditions).toBe(conditions);
        expect(snapshot.conditionsPresentation).toBe(oldQuote.conditionsPresentation);
        expect(prepareOrderDocument(snapshot).metadata).toContainEqual([
          'Confirmée le :',
          '1 janvier 2027',
        ]);
        const evidence = Schema.decodeUnknownSync(Schema.Uint8Array)(
          database.sqlite
            .prepare('select evidence_content from quote_signatures where id = ?')
            .pluck()
            .get(accepted.signatureId),
        );
        expect(
          Schema.decodeUnknownSync(Schema.fromJsonString(CurrentOrderConfirmationEvidence))(
            Buffer.from(evidence).toString('utf8'),
          ),
        ).toEqual({ version: 2, orderCalendar: { timeZone: 'Europe/Paris' } });
        const later = yield* orders
          .getSnapshot(accepted.orderId)
          .pipe(
            Effect.provideService(
              BusinessConfig,
              BusinessConfig.of({ timeZone: DateTime.zoneMakeNamedUnsafe('America/New_York') }),
            ),
          );
        expect(later).toEqual(snapshot);
        expect(readOriginal()).toEqual(original);
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );
  });

  it('keeps historical confirmation evidence, snapshots and PDF artifacts unchanged', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const signedAt = DateTime.toEpochMillis(DateTime.makeUnsafe('2026-08-19T23:30:00.000Z'));
        yield* seedSentQuote(signedAt + 60_000, 'Conditions conservées');
        const database = yield* Database;
        const signatureId = '01ARZ3NDEKTSV4RRFFQ69G5FAJ';
        const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAK';
        const auditId = '01ARZ3NDEKTSV4RRFFQ69G5FAM';
        const orderArtifactId = '01ARZ3NDEKTSV4RRFFQ69G5FAN';
        const snapshotJson = Schema.decodeUnknownSync(Schema.String)(
          database.sqlite
            .prepare('select render_snapshot from quote_revisions where id = ?')
            .pluck()
            .get(revisionId),
        );
        const evidence = Buffer.from(
          JSON.stringify({
            version: 1,
            quoteId,
            revisionId,
            signatureId,
            orderId,
            acceptedAt: '2026-08-19T23:30:00.000Z',
            snapshot: JSON.parse(snapshotJson),
          }),
        );
        const digest = (content: string | Uint8Array) =>
          createHash('sha256').update(content).digest('hex');
        database.sqlite.prepare("update quotes set status = 'accepted' where id = ?").run(quoteId);
        database.sqlite
          .prepare('update quote_links set consumed_at = ? where id = ?')
          .run(signedAt, linkId);
        database.sqlite
          .prepare(
            `insert into audit_events (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
           values (?, 'quote.accepted', null, 'quote', ?, ?, '{}')`,
          )
          .run(auditId, quoteId, signedAt);
        database.sqlite
          .prepare(
            `insert into quote_signatures
           (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind, signature_value,
            signed_at, ip_address, user_agent, snapshot_sha256, pdf_sha256, audit_event_id, evidence_content, evidence_sha256)
           values (?, ?, ?, ?, 'Client', 1, 'typed', 'Client', ?, '127.0.0.1', '', ?, ?, ?, ?, ?)`,
          )
          .run(
            signatureId,
            quoteId,
            revisionId,
            linkId,
            signedAt,
            digest(snapshotJson),
            digest('%PDF-test'),
            auditId,
            evidence,
            digest(evidence),
          );
        database.sqlite
          .prepare(
            `insert into orders (id, reference, quote_id, revision_id, client_id, signature_id, status, created_at)
           values (?, 'CO-2026-000001', ?, ?, ?, ?, 'confirmed', ?)`,
          )
          .run(orderId, quoteId, revisionId, clientId, signatureId, signedAt);
        const pdf = Buffer.from('%PDF-historical-order');
        database.sqlite
          .prepare(
            `insert into document_artifacts (id, order_id, kind, content_type, byte_size, sha256, content, created_at)
           values (?, ?, 'order-pdf', 'application/pdf', ?, ?, ?, ?)`,
          )
          .run(orderArtifactId, orderId, pdf.byteLength, digest(pdf), pdf, signedAt);
        const readArtifacts = () =>
          database.sqlite.prepare('select * from document_artifacts order by id').all();
        const originalArtifacts = readArtifacts();
        const orders = yield* Orders;
        const snapshot = yield* orders.getSnapshot(orderId);
        expect(snapshot.calendar).toBeUndefined();
        expect(snapshot.conditions).toBe('Conditions conservées');
        expect(prepareOrderDocument(snapshot).metadata).toContainEqual([
          'Confirmée le :',
          '19 août 2026',
        ]);
        expect(readArtifacts()).toEqual(originalArtifacts);
        expect(
          database.sqlite
            .prepare('select render_snapshot from quote_revisions where id = ?')
            .pluck()
            .get(revisionId),
        ).toBe(snapshotJson);
        expect(
          database.sqlite
            .prepare('select evidence_content from quote_signatures where id = ?')
            .pluck()
            .get(signatureId),
        ).toEqual(evidence);
      }).pipe(Effect.provide(lifecycleLayer())),
    );
  });

  it('persists expiration during a read without waiting for real time', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(expiresAt);
        const links = yield* QuoteLinks;
        const quotes = yield* Quotes;
        const publicRead = yield* Effect.result(links.get(token));
        const detail = yield* quotes.get(quoteId);
        const database = yield* Database;
        const expirationEvents = database.sqlite
          .prepare("select count(*) from audit_events where action = 'quote.expired'")
          .pluck()
          .get();
        return { publicRead, detail, expirationEvents };
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.publicRead._tag).toBe('Failure');
    expect(result.detail.status).toBe('expired');
    expect(result.expirationEvents).toBe(1);
  });

  it('creates a draft revision after expiration', async () => {
    const detail = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(expiresAt);
        const quotes = yield* Quotes;
        return yield* quotes.createRevision(
          quoteId,
          {
            expectedVersion: 1,
            title: 'Revised quote',
            conditions: '',
            lines: [
              {
                description: 'Revised service',
                quantityMilli: 1_000,
                unitPriceCents: 200,
                vatRateBasisPoints: 2_000,
              },
            ],
          },
          actorId,
        );
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(detail).toMatchObject({ status: 'draft', version: 2 });
    expect(detail.currentRevision.title).toBe('Revised quote');
    expect(detail.currentRevision.pdfAvailable).toBe(false);
    expect(detail.revisions.find((revision) => revision.version === 1)?.pdfAvailable).toBe(true);
  });

  it('keeps an accepted quote available after the signature deadline', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(createdAt + 100);
        const links = yield* QuoteLinks;
        yield* links.accept(signatureRequest, publicContext);
        yield* TestClock.setTime(expiresAt);
        return {
          consultation: yield* links.get(token),
          pdf: yield* links.getPdf(token),
        };
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.consultation).toMatchObject({ status: 'accepted', canSign: false });
    expect(result.pdf).toMatchObject({ quoteId, reference: 'DE-1970-000001', version: 1 });
  });

  it('keeps acceptance atomic when expiration runs concurrently', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(expiresAt);
        const links = yield* QuoteLinks;
        const quotes = yield* Quotes;
        const [acceptance, detail] = yield* Effect.all(
          [Effect.result(links.accept(signatureRequest, publicContext)), quotes.get(quoteId)],
          { concurrency: 'unbounded' },
        );
        const database = yield* Database;
        return {
          acceptance,
          detail,
          orders: database.sqlite.prepare('select count(*) from orders').pluck().get(),
          signatures: database.sqlite
            .prepare('select count(*) from quote_signatures')
            .pluck()
            .get(),
        };
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.acceptance._tag).toBe('Failure');
    expect(result.detail.status).toBe('expired');
    expect(result.orders).toBe(0);
    expect(result.signatures).toBe(0);
  });

  it('revokes every active public link when the client is archived', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(createdAt + 100);
        const database = yield* Database;
        database.sqlite
          .prepare(
            `insert into quote_links (id, revision_id, token_hmac, created_at, expires_at)
             values (?, ?, ?, ?, ?)`,
          )
          .run(secondLinkId, revisionId, hmac(quoteLinkHmacKey, secondToken), createdAt, expiresAt);
        const clients = yield* Clients;
        yield* clients.archive(clientId, actorId);
        const links = yield* QuoteLinks;
        return {
          consultation: yield* Effect.result(links.get(token)),
          pdf: yield* Effect.result(links.getPdf(token)),
          acceptance: yield* Effect.result(links.accept(signatureRequest, publicContext)),
          revokedLinks: database.sqlite
            .prepare('select count(*) from quote_links where revoked_at = ?')
            .pluck()
            .get(createdAt + 100),
          orders: database.sqlite.prepare('select count(*) from orders').pluck().get(),
        };
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.consultation._tag).toBe('Failure');
    expect(result.pdf._tag).toBe('Failure');
    expect(result.acceptance._tag).toBe('Failure');
    expect(result.revokedLinks).toBe(2);
    expect(result.orders).toBe(0);
  });

  it('cancels a sent quote and revokes every public link', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        yield* TestClock.setTime(createdAt + 100);
        const quotes = yield* Quotes;
        const detail = yield* quotes.cancel(
          quoteId,
          { expectedVersion: 1, reason: 'client-declined', note: '' },
          actorId,
        );
        const links = yield* QuoteLinks;
        const database = yield* Database;
        return {
          detail,
          consultation: yield* Effect.result(links.get(token)),
          revokedAt: database.sqlite
            .prepare('select revoked_at from quote_links where id = ?')
            .pluck()
            .get(linkId),
          events: database.sqlite
            .prepare("select count(*) from audit_events where action = 'quote.cancelled'")
            .pluck()
            .get(),
        };
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.detail.status).toBe('cancelled');
    expect(result.consultation._tag).toBe('Failure');
    expect(result.revokedAt).toBe(createdAt + 100);
    expect(result.events).toBe(1);
  });

  it('rejects a public PDF whose SHA-256 digest does not match', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSentQuote();
        const database = yield* Database;
        database.sqlite.exec('drop trigger document_artifacts_immutable_update');
        database.sqlite
          .prepare('update document_artifacts set sha256 = ? where id = ?')
          .run('0'.repeat(64), artifactId);
        return yield* Effect.result((yield* QuoteLinks).getPdf(token));
      }).pipe(Effect.provide(lifecycleLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result._tag).toBe('Failure');
  });
});
