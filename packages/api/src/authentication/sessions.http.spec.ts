import { AccountSessionList } from '@froment/contracts';
import { Schema } from 'effect';
import { CookieJar } from 'tough-cookie';
import { describe, expect, it } from 'vitest';
import { cookieHeaders, storeResponseCookies } from '../server/cookies.spec-helper.js';
import {
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

describe('account sessions HTTP', () => {
  it('lists only owned sessions and revokes a remote session after origin validation', async () => {
    const server = await startHttpTestServer();
    try {
      const client = await createClient(server);
      const clientHeaders = await createClientSession(server, client.id);
      const second = await fetch(`${server.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { origin: server.baseUrl, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'administrator@example.test',
          password: 'administrator-password',
        }),
      });
      expect(second.status).toBe(200);
      const jar = new CookieJar();
      await storeResponseCookies(jar, second, server.baseUrl);
      const secondHeaders = await cookieHeaders(jar, `${server.baseUrl}/api/auth`);
      const url = `${server.baseUrl}/api/auth/sessions`;
      expect((await fetch(url)).status).toBe(401);
      const response = await fetch(url, { headers: server.sessionHeaders });
      expect(response.headers.get('cache-control')).toContain('no-store');
      const sessions = Schema.decodeUnknownSync(AccountSessionList)(await response.json());
      expect(sessions).toHaveLength(2);
      const remote = sessions.find((session) => !session.current);
      const current = sessions.find((session) => session.current);
      if (remote === undefined || current === undefined) throw new Error('sessions.missing');
      const clientList = await fetch(url, { headers: clientHeaders });
      expect(Schema.decodeUnknownSync(AccountSessionList)(await clientList.json())).toHaveLength(1);
      const revoke = (id: string, headers: Readonly<Record<string, string>>) =>
        fetch(`${url}/${id}/revoke`, {
          method: 'POST',
          headers: { origin: server.baseUrl, ...headers },
        });
      expect((await revoke(remote.id, clientHeaders)).status).toBe(404);
      expect((await revoke(current.id, server.sessionHeaders)).status).toBe(409);
      expect(
        (await revoke(remote.id, { ...server.sessionHeaders, origin: 'https://untrusted.example' }))
          .status,
      ).toBe(403);
      expect((await revoke(remote.id, server.sessionHeaders)).status).toBe(204);
      expect((await revoke(remote.id, server.sessionHeaders)).status).toBe(204);
      expect(
        (await fetch(`${server.baseUrl}/api/auth/account`, { headers: secondHeaders })).status,
      ).toBe(401);
      expect(
        (
          await fetch(`${server.baseUrl}/api/auth/refresh`, {
            method: 'POST',
            headers: { ...secondHeaders, origin: server.baseUrl },
          })
        ).status,
      ).toBe(401);
      const remaining = await fetch(url, { headers: server.sessionHeaders });
      expect(Schema.decodeUnknownSync(AccountSessionList)(await remaining.json())).toEqual([
        current,
      ]);
    } finally {
      await server.close();
    }
  }, 20000);
});
