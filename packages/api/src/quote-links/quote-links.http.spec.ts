import { createHash } from 'node:crypto';

import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createClient,
  createQuote,
  renderQuotePdf,
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('quote link HTTP routes', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('sends, exposes, downloads, and signs a quote exactly once', async () => {
    await setIssuer(server);
    const quote = await createQuote(server, (await createClient(server)).id);
    const artifact = await renderQuotePdf(server, quote.id);
    const sendResponses = await Promise.all([
      fetch(`${server.baseUrl}/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
      fetch(`${server.baseUrl}/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({ expectedVersion: 1 }),
      }),
    ]);
    expect(sendResponses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const sent = (await sendResponses.find(({ status }) => status === 200)!.json()) as {
      link: { id: string; url: string };
    };
    const token = new URL(sent.link.url).hash.slice(1);
    const publicHeaders = { 'content-type': 'application/json', origin: server.baseUrl };

    const consultation = await fetch(`${server.baseUrl}/api/public/quote-link`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ token }),
    });
    expect(consultation.headers.get('cache-control')).toBe('no-store');
    expect(consultation.headers.get('referrer-policy')).toBe('no-referrer');
    await expect(consultation.json()).resolves.toMatchObject({ status: 'sent', canSign: true });

    const download = await fetch(`${server.baseUrl}/api/public/quote-link/pdf`, {
      method: 'POST',
      headers: publicHeaders,
      body: JSON.stringify({ token }),
    });
    expect(download.headers.get('x-content-type-options')).toBe('nosniff');
    const pdf = Buffer.from(await download.arrayBuffer());
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(artifact.sha256);

    const signature = {
      token,
      signerName: 'Ada Lovelace',
      consent: true,
      signature: { kind: 'typed', value: 'Ada Lovelace' },
    };
    const signed = await Promise.all([
      fetch(`${server.baseUrl}/api/public/quote-link/signature`, {
        method: 'POST',
        headers: { ...publicHeaders, 'user-agent': 'HTTP test' },
        body: JSON.stringify(signature),
      }),
      fetch(`${server.baseUrl}/api/public/quote-link/signature`, {
        method: 'POST',
        headers: { ...publicHeaders, 'user-agent': 'HTTP test' },
        body: JSON.stringify(signature),
      }),
    ]);
    expect(signed.map(({ status }) => status).sort()).toEqual([200, 409]);

    const database = new Sqlite(server.databaseFilename, { readonly: true });
    expect(
      database
        .prepare('select count(*) from quote_signatures where quote_id = ?')
        .pluck()
        .get(quote.id),
    ).toBe(1);
    expect(
      database.prepare('select count(*) from orders where quote_id = ?').pluck().get(quote.id),
    ).toBe(1);
    expect(
      database
        .prepare('select count(*) from audit_events where metadata like ?')
        .pluck()
        .get(`%${token}%`),
    ).toBe(0);
    database.close();
    expect(server.output()).not.toContain(token);
  }, 15_000);

  it('hides unknown public tokens', async () => {
    const response = await fetch(`${server.baseUrl}/api/public/quote-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: server.baseUrl },
      body: JSON.stringify({ token: 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD' }),
    });
    expect(response.status).toBe(404);
  });
});
