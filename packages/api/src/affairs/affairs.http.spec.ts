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

    const obsoleteLinkResponse = await request(`/api/affairs/${created.id}/quotes`, 'POST', {
      expectedVersion: created.version,
      quoteId: quote.id,
    });
    expect(obsoleteLinkResponse.status).toBe(404);
    const updated = Schema.decodeUnknownSync(Affair)(
      await (
        await request(`/api/affairs/${created.id}`, 'PUT', {
          expectedVersion: created.version,
          title: 'Client renewal complete',
          status: 'closed',
        })
      ).json(),
    );
    expect(updated).toMatchObject({ status: 'closed', version: 2, quoteIds: [] });
  } finally {
    await server.close();
  }
}, 30_000);
