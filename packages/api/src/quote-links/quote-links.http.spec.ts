import { createHash } from 'node:crypto';

import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  QuoteSendResult,
  type PublicQuoteAccessRequestValue,
  type PublicQuoteSignatureRequestValue,
} from '@froment/contracts';
import { Schema } from 'effect';

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

  it('replaces a lost link atomically without changing the published PDF or revision', async () => {
    await setIssuer(server);
    const quote = await createQuote(server, (await createClient(server, 'Link recovery')).id);
    const artifact = await renderQuotePdf(server, quote.id);
    const endpoint = `${server.baseUrl}/api/quotes/${quote.id}/signature-link`;
    const sendResponse = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/send`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    const first = Schema.decodeUnknownSync(QuoteSendResult)(await sendResponse.json());
    const oldToken = new URL(first.link.url).hash.slice(1);
    const stateResponse = await fetch(endpoint, { headers: server.sessionHeaders });
    expect(stateResponse.status).toBe(200);
    expect(stateResponse.headers.get('cache-control')).toBe('no-store');
    expect(await stateResponse.json()).toEqual({
      id: first.link.id,
      expiresAt: first.link.expiresAt,
    });
    const request = { expectedVersion: 1, expectedLinkId: first.link.id };
    const replace = () =>
      fetch(endpoint, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify(request),
      });
    const responses = await Promise.all([replace(), replace()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const success = responses.find((response) => response.status === 200);
    if (!success) throw new Error('Missing successful replacement');
    const second = Schema.decodeUnknownSync(QuoteSendResult)(await success.json());
    const token = new URL(second.link.url).hash.slice(1);
    expect(second.revisionId).toBe(first.revisionId);
    expect(second.version).toBe(first.version);
    expect(second.link.id).not.toBe(first.link.id);
    const publicRequest = (
      path: string,
      body: PublicQuoteAccessRequestValue | PublicQuoteSignatureRequestValue,
    ) =>
      fetch(`${server.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: server.baseUrl },
        body: JSON.stringify(body),
      });
    expect((await publicRequest('/api/public/quote-link', { token: oldToken })).status).toBe(404);
    const download = await publicRequest('/api/public/quote-link/pdf', { token });
    expect(download.status).toBe(200);
    expect(
      createHash('sha256')
        .update(Buffer.from(await download.arrayBuffer()))
        .digest('hex'),
    ).toBe(artifact.sha256);
    const database = new Sqlite(server.databaseFilename, { readonly: true });
    try {
      expect(
        database
          .prepare('select count(*) from quote_revisions where quote_id = ?')
          .pluck()
          .get(quote.id),
      ).toBe(1);
      expect(
        database
          .prepare(
            "select count(*) from audit_events where resource_id = ? and action = 'quote.link-replaced'",
          )
          .pluck()
          .get(quote.id),
      ).toBe(1);
      expect(
        database
          .prepare('select count(*) from audit_events where metadata like ?')
          .pluck()
          .get(`%${token}%`),
      ).toBe(0);
    } finally {
      database.close();
    }
    expect(
      (
        await publicRequest('/api/public/quote-link/signature', {
          token,
          signerName: 'Link recipient',
          consent: true,
          signature: { kind: 'typed', value: 'Link recipient' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(endpoint, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({ expectedVersion: 1, expectedLinkId: second.link.id }),
        })
      ).status,
    ).toBe(409);
    expect(server.output()).not.toContain(token);
  }, 15_000);
});
