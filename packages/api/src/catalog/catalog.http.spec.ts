import { CatalogItem, CatalogItemList, QuoteDetail } from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createClient,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('catalog HTTP lifecycle', () => {
  let server: HttpTestServer;
  beforeAll(async () => {
    server = await startHttpTestServer();
  }, 30_000);
  afterAll(async () => server.close());
  it('creates, revises, archives and restores services without changing saved quote lines', async () => {
    const payload = {
      description: 'Audit',
      quantityMilli: 1500,
      unitPriceCents: 10000,
      vatRateBasisPoints: 2000,
      currency: 'EUR',
    };
    const create = await fetch(`${server.baseUrl}/api/catalog`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(payload),
    });
    expect(create.status).toBe(200);
    const item = Schema.decodeUnknownSync(CatalogItem)(await create.json());
    expect(item).toMatchObject({ ...payload, archived: false, version: 1 });
    const client = await createClient(server);
    const quoteResponse = await fetch(`${server.baseUrl}/api/quotes`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        clientId: client.id,
        title: 'Catalog quote',
        conditions: '',
        lines: [payload],
      }),
    });
    expect(quoteResponse.status).toBe(200);
    const quote = Schema.decodeUnknownSync(QuoteDetail)(await quoteResponse.json());
    const update = (expectedVersion: number, archived: boolean) =>
      fetch(`${server.baseUrl}/api/catalog/${item.id}`, {
        method: 'PUT',
        headers: server.jsonHeaders,
        body: JSON.stringify({ ...payload, unitPriceCents: 12000, expectedVersion, archived }),
      });
    const changed = await update(1, false);
    expect(changed.status).toBe(200);
    expect(Schema.decodeUnknownSync(CatalogItem)(await changed.json()).version).toBe(2);
    expect((await update(1, true)).status).toBe(409);
    expect((await update(2, true)).status).toBe(200);
    const list = await fetch(`${server.baseUrl}/api/catalog`, { headers: server.sessionHeaders });
    expect(Schema.decodeUnknownSync(CatalogItemList)(await list.json())).toMatchObject([
      { id: item.id, archived: true, version: 3 },
    ]);
    expect((await update(3, false)).status).toBe(200);
    const unchanged = await fetch(`${server.baseUrl}/api/quotes/${quote.id}`, {
      headers: server.sessionHeaders,
    });
    expect(
      Schema.decodeUnknownSync(QuoteDetail)(await unchanged.json()).currentRevision.lines,
    ).toEqual(quote.currentRevision.lines);
    const database = new Sqlite(server.databaseFilename, { readonly: true });
    try {
      expect(
        database
          .prepare("select count(*) from audit_events where resource_type = 'catalog-item'")
          .pluck()
          .get(),
      ).toBe(4);
    } finally {
      database.close();
    }
  });
  it('rejects unauthenticated requests and invalid amounts', async () => {
    expect((await fetch(`${server.baseUrl}/api/catalog`)).status).toBe(401);
    for (const invalid of [
      { quantityMilli: 0 },
      { unitPriceCents: -1 },
      { vatRateBasisPoints: 10001 },
      { description: ' ' },
      { currency: 'USD' },
    ]) {
      const response = await fetch(`${server.baseUrl}/api/catalog`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({
          description: 'Audit',
          quantityMilli: 1000,
          unitPriceCents: 100,
          vatRateBasisPoints: 0,
          currency: 'EUR',
          ...invalid,
        }),
      });
      expect(response.ok).toBe(false);
    }
    const missing = await fetch(`${server.baseUrl}/api/catalog/01ARZ3NDEKTSV4RRFFQ69G5FAV`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        description: 'Audit',
        quantityMilli: 1000,
        unitPriceCents: 100,
        vatRateBasisPoints: 0,
        currency: 'EUR',
        archived: false,
        expectedVersion: 1,
      }),
    });
    expect(missing.status).toBe(404);
  });
});
