import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  acceptQuote,
  createClient,
  createClientToken,
  createQuote,
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('order HTTP routes', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('lists accepted orders and renders one stable PDF', async () => {
    await setIssuer(server);
    const client = await createClient(server);
    const clientToken = await createClientToken(server, client.id);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);

    expect((await fetch(`${server.baseUrl}/api/orders`)).status).toBe(401);
    const list = await fetch(`${server.baseUrl}/api/orders`, { headers: server.authorization });
    expect(list.headers.get('cache-control')).toBe('no-store');
    await expect(list.json()).resolves.toEqual([
      expect.objectContaining({ id: accepted.orderId, quoteId: quote.id, invoiceId: null }),
    ]);

    const preview = await fetch(`${server.baseUrl}/api/orders/${accepted.orderId}/preview`, {
      headers: server.authorization,
    });
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(
      Buffer.from(await preview.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');

    const renders = await Promise.all([
      fetch(`${server.baseUrl}/api/orders/${accepted.orderId}/pdf`, {
        method: 'POST',
        headers: server.authorization,
      }),
      fetch(`${server.baseUrl}/api/orders/${accepted.orderId}/pdf`, {
        method: 'POST',
        headers: server.authorization,
      }),
    ]);
    const artifacts = (await Promise.all(renders.map((response) => response.json()))) as Array<{
      id: string;
      sha256: string;
    }>;
    expect(artifacts[0]).toEqual(artifacts[1]);
    const download = await fetch(`${server.baseUrl}/api/orders/${accepted.orderId}/pdf`, {
      headers: server.authorization,
    });
    expect(download.headers.get('content-disposition')).toContain(`${accepted.orderReference}.pdf`);
    const pdf = Buffer.from(await download.arrayBuffer());
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(artifacts[0]!.sha256);

    const clientPdf = await fetch(`${server.baseUrl}/api/client/orders/${accepted.orderId}/pdf`, {
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(Buffer.from(await clientPdf.arrayBuffer())).toEqual(pdf);
  }, 15_000);
});
