import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('quote HTTP routes', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('creates revisions and returns stable PDF content with secure headers', async () => {
    await setIssuer(server, 'First issuer');
    const quote = await createQuote(server, (await createClient(server)).id);
    expect(quote).toMatchObject({ version: 1, currentRevision: { totalCents: 18_002 } });

    const preview = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions/1/preview`, {
      headers: server.sessionHeaders,
    });
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-type')).toContain('application/pdf');
    expect(preview.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(
      Buffer.from(await preview.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');

    const render = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions/1/pdf`, {
      method: 'POST',
      headers: server.sessionHeaders,
    });
    const artifact = (await render.json()) as { byteSize: number; sha256: string };
    const download = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions/1/pdf`, {
      headers: server.sessionHeaders,
    });
    expect(download.headers.get('content-disposition')).toContain(`${quote.reference}-v1.pdf`);
    const pdf = Buffer.from(await download.arrayBuffer());
    expect(pdf.byteLength).toBe(artifact.byteSize);
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(artifact.sha256);

    const revision = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        expectedVersion: 1,
        title: 'Revised quote',
        conditions: '',
        lines: [
          {
            description: 'Delivery',
            quantityMilli: 1,
            unitPriceCents: 500,
            vatRateBasisPoints: 5_000,
          },
        ],
      }),
    });
    await expect(revision.json()).resolves.toMatchObject({
      version: 2,
      currentRevision: { totalCents: 2 },
    });
    const stale = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        expectedVersion: 1,
        title: 'Stale',
        conditions: '',
        lines: [
          {
            description: 'Stale line',
            quantityMilli: 1_000,
            unitPriceCents: 100,
            vatRateBasisPoints: 0,
          },
        ],
      }),
    });
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      code: 'quote.version_conflict',
      currentVersion: 2,
    });
  }, 15_000);

  it('requires authentication and route permissions', async () => {
    expect((await fetch(`${server.baseUrl}/api/quotes`)).status).toBe(401);
    const tokenResponse = await fetch(`${server.baseUrl}/api/tokens`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        name: 'read-only quote token',
        permissions: ['quote.read'],
        expiresAt: Date.now() + 86_400_000,
        rateLimitPerMinute: 60,
      }),
    });
    const token = (await tokenResponse.json()) as { secret: string };
    expect(
      (
        await fetch(`${server.baseUrl}/api/quotes`, {
          headers: { authorization: `Bearer ${token.secret}` },
        })
      ).status,
    ).toBe(200);
    const denied = await fetch(`${server.baseUrl}/api/quotes`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.secret}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(denied.status).toBe(403);
  });
});
