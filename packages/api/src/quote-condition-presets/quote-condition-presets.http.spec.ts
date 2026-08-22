import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHttpTestServer, type HttpTestServer } from '../server/server.spec-helper.js';

describe('quote condition preset HTTP routes', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('creates, rejects duplicate names, updates, lists, and deletes presets', async () => {
    const create = await fetch(`${server.baseUrl}/api/quote-condition-presets`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ name: 'Standard payment', conditions: 'Due in 30 days.' }),
    });
    expect(create.status).toBe(200);
    const preset = (await create.json()) as { id: string; name: string; conditions: string };

    const duplicate = await fetch(`${server.baseUrl}/api/quote-condition-presets`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ name: preset.name, conditions: 'Other terms.' }),
    });
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      code: 'quote_condition_preset.name_conflict',
    });

    const update = await fetch(`${server.baseUrl}/api/quote-condition-presets/${preset.id}`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({ name: preset.name, conditions: 'Due in 45 days.' }),
    });
    expect(update.status).toBe(200);
    const updated = await update.json();
    const list = await fetch(`${server.baseUrl}/api/quote-condition-presets`, {
      headers: server.authorization,
    });
    await expect(list.json()).resolves.toEqual([updated]);

    const remove = await fetch(`${server.baseUrl}/api/quote-condition-presets/${preset.id}`, {
      method: 'DELETE',
      headers: server.authorization,
    });
    expect(remove.status).toBe(200);
    expect((await fetch(`${server.baseUrl}/api/quote-condition-presets`)).status).toBe(401);
  });
});
