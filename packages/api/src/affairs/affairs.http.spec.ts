import { Affair, AffairList } from '@froment/contracts';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('creates one affair with each quote and keeps independent affairs editable', async () => {
  const server = await startHttpTestServer();
  const request = (path: string, method: 'POST' | 'PUT', body: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(body),
    });
  try {
    expect((await fetch(`${server.baseUrl}/api/affairs`)).status).toBe(401);
    await setIssuer(server);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    const initial = Schema.decodeUnknownSync(AffairList)(
      await (
        await fetch(`${server.baseUrl}/api/affairs`, { headers: server.sessionHeaders })
      ).json(),
    );
    expect(initial).toHaveLength(1);
    expect(initial[0]?.quoteIds).toEqual([quote.id]);

    const createBody = { requestId: randomUUID(), clientId: client.id, title: 'Client renewal' };
    const created = Schema.decodeUnknownSync(Affair)(
      await (await request('/api/affairs', 'POST', createBody)).json(),
    );
    expect(created).toMatchObject({ status: 'open', version: 1, quoteIds: [] });
    expect(
      Schema.decodeUnknownSync(Affair)(
        await (await request('/api/affairs', 'POST', createBody)).json(),
      ),
    ).toEqual(created);

    const linkedQuote = await createQuote(server, client.id, 'EUR', created.id);
    const afterLinkedQuote = Schema.decodeUnknownSync(AffairList)(
      await (
        await fetch(`${server.baseUrl}/api/affairs`, { headers: server.sessionHeaders })
      ).json(),
    );
    expect(afterLinkedQuote).toHaveLength(2);
    const linkedAffair = afterLinkedQuote.find((affair) => affair.id === created.id);
    if (linkedAffair === undefined) throw new Error('The linked affair is missing.');
    expect(linkedAffair.quoteIds).toEqual([linkedQuote.id]);

    const obsoleteLinkResponse = await request(`/api/affairs/${created.id}/quotes`, 'POST', {
      expectedVersion: created.version,
      quoteId: quote.id,
    });
    expect(obsoleteLinkResponse.status).toBe(404);
    const updated = Schema.decodeUnknownSync(Affair)(
      await (
        await request(`/api/affairs/${created.id}`, 'PUT', {
          expectedVersion: linkedAffair.version,
          title: 'Client renewal complete',
          status: 'closed',
        })
      ).json(),
    );
    expect(updated).toMatchObject({ status: 'closed', version: 3, quoteIds: [linkedQuote.id] });

    const closedAffairQuote = await request('/api/quotes', 'POST', {
      affairId: created.id,
      clientId: client.id,
      currency: 'EUR',
      title: 'Late quote',
      conditions: '',
      lines: [
        {
          description: 'Consulting',
          quantityMilli: 1_000,
          unitPriceCents: 10_000,
          vatRateBasisPoints: 2_000,
        },
      ],
    });
    expect(closedAffairQuote.status).toBe(409);
    await expect(closedAffairQuote.json()).resolves.toMatchObject({ code: 'affair.conflict' });
  } finally {
    await server.close();
  }
}, 30_000);
