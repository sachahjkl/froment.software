import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('issuer settings HTTP routes', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('updates, reads, audits, and protects issuer settings', async () => {
    expect((await fetch(`${server.baseUrl}/api/issuer-settings`)).status).toBe(401);
    const issuer = await setIssuer(server, 'Issuer HTTP test');
    const response = await fetch(`${server.baseUrl}/api/issuer-settings`, {
      headers: server.sessionHeaders,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual(issuer);

    const database = new Sqlite(server.databaseFilename, { readonly: true });
    expect(
      database
        .prepare("select count(*) from audit_events where action = 'issuer.updated'")
        .pluck()
        .get(),
    ).toBe(1);
    database.close();
  });
});
