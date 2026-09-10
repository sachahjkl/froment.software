import { GlobalAuditPage } from '@froment/contracts';
import { Schema } from 'effect';
import { expect, it } from 'vitest';

import { createClient, startHttpTestServer } from '../server/server.spec-helper.js';

it('applies the configured audit page size through the production server layers', async () => {
  const server = await startHttpTestServer({ auditPageSize: 3 });
  try {
    const clients: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      clients.push((await createClient(server, `Audit client ${index}`)).id);
    }
    const expected = clients.toReversed();
    const read = async (params: Readonly<Record<string, string>> = {}) => {
      const query = new URLSearchParams({ action: 'client.created', ...params });
      const response = await fetch(`${server.baseUrl}/api/audit-events?${query}`, {
        headers: server.sessionHeaders,
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      return Schema.decodeUnknownSync(GlobalAuditPage)(await response.json());
    };

    const first = await read();
    expect(first.items.map(({ resourceId }) => resourceId)).toEqual(expected.slice(0, 3));
    expect(first.previousCursor).toBeNull();
    if (first.nextCursor === null) throw new Error('Missing next cursor');
    const second = await read({ cursor: first.nextCursor });
    expect(second.items.map(({ resourceId }) => resourceId)).toEqual(expected.slice(3, 6));
    if (second.previousCursor === null || second.nextCursor === null) {
      throw new Error('Missing page cursors');
    }
    expect(await read({ cursor: second.previousCursor, direction: 'newer' })).toEqual(first);
    const last = await read({ cursor: second.nextCursor, direction: 'older' });
    expect(last.items.map(({ resourceId }) => resourceId)).toEqual(expected.slice(6));
    expect(last.nextCursor).toBeNull();
    expect((await read({ limit: '1' })).items).toHaveLength(1);

    const refused = await fetch(`${server.baseUrl}/api/audit-events?limit=4`, {
      headers: server.sessionHeaders,
    });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({
      _tag: 'InvalidAuditQuery',
      code: 'audit.invalid_query',
    });
    expect(refused.headers.get('cache-control')).toBe('no-store');
  } finally {
    await server.close();
  }
});
