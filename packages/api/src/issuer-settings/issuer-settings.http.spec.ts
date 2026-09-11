import Sqlite from 'better-sqlite3';
import { IssuerSettingsDetail } from '@froment/contracts';
import { Schema } from 'effect';
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

  it('rejects a stale form atomically and permits an update after reloading', async () => {
    const url = `${server.baseUrl}/api/issuer-settings`;
    const get = async () =>
      Schema.decodeUnknownSync(IssuerSettingsDetail)(
        await (await fetch(url, { headers: server.sessionHeaders })).json(),
      );
    const first = await get();
    const stale = await get();
    const put = (
      settings: typeof IssuerSettingsDetail.Type,
      changes: { vatNumber?: string; phone?: string },
    ) =>
      fetch(url, {
        method: 'PUT',
        headers: server.jsonHeaders,
        body: JSON.stringify({ ...settings, ...changes, expectedVersion: settings.version }),
      });
    expect((await put(first, { vatNumber: 'TEST-VAT-NEW' })).status).toBe(200);
    const conflict = await put(stale, { phone: 'TEST-PHONE-NEW' });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      _tag: 'IssuerSettingsConflict',
      code: 'issuer.conflict',
    });
    const current = await get();
    expect(current).toMatchObject({
      vatNumber: 'TEST-VAT-NEW',
      phone: first.phone,
      version: first.version + 1,
    });
    const database = new Sqlite(server.databaseFilename, { readonly: true });
    try {
      expect(
        database
          .prepare("select count(*) from audit_events where action = 'issuer.updated'")
          .pluck()
          .get(),
      ).toBe(2);
    } finally {
      database.close();
    }
    expect((await put(current, { phone: 'TEST-PHONE-NEW' })).status).toBe(200);
    expect(await get()).toMatchObject({
      vatNumber: 'TEST-VAT-NEW',
      phone: 'TEST-PHONE-NEW',
      version: first.version + 2,
    });
  });
});
