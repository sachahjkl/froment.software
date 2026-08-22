import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { DateTime, Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../src/audit/audit.js';
import { BusinessConfig } from '../src/business/business-config.js';
import { AuthenticationConfig, hmac } from '../src/authentication/authentication-config.js';
import { Clients, ClientsLive } from '../src/clients/clients.js';
import { Database } from '../src/database/database.js';
import { makeMigratedDatabaseLayer } from './database-layer.js';
import { IssuerSettingsLive } from '../src/issuer-settings/service.js';
import { QuoteLinks, QuoteLinksLive } from '../src/quote-links/service.js';
import { Quotes, QuotesLive } from '../src/quotes/quotes.js';

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
    accessHmacKey: Buffer.alloc(32, 1),
    integrationTokenHmacKey: Buffer.alloc(32, 4),
    sessionHmacKey: Buffer.alloc(32, 2),
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
    migrationsFolder: join(import.meta.dirname, '..', 'drizzle'),
  });

const lifecycleLayer = () => {
  const quoteCore = QuotesLive.pipe(Layer.provideMerge(IssuerSettingsLive));
  return Layer.mergeAll(quoteCore, QuoteLinksLive, ClientsLive).pipe(
    Layer.provide(AuditLive),
    Layer.provide(configLayer),
    Layer.provide(businessConfigLayer),
    Layer.provideMerge(databaseLayer()),
  );
};

const seedSentQuote = Effect.fn('seedSentQuote')(function* () {
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
    conditions: '',
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
         values (?, ?, 1, 'Client', 'Quote', '', 'EUR', 100, 20, 120, ?, ?,
                 'quote-default', 1, ?)`,
      )
      .run(revisionId, quoteId, createdAt, actorId, JSON.stringify(snapshot));
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
      .run(linkId, revisionId, hmac(quoteLinkHmacKey, token), createdAt, expiresAt);
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
