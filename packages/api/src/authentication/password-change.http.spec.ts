import { describe, expect, it } from 'vitest';
import {
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

describe('password change HTTP', () => {
  it('limits password verification attempts per account', async () => {
    const server = await startHttpTestServer();
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const response = await fetch(`${server.baseUrl}/api/auth/password`, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify({
            currentPassword: 'wrong-password-123',
            newPassword: 'replacement-password-123',
          }),
        });
        expect(response.status).toBe(attempt < 5 ? 409 : 429);
      }
    } finally {
      await server.close();
    }
  }, 20000);
  it('protects password changes and closes administrator and client sessions', async () => {
    const server = await startHttpTestServer();
    try {
      const client = await createClient(server);
      const clientHeaders = await createClientSession(server, client.id);
      const url = `${server.baseUrl}/api/auth/password`;
      const change = (
        headers: Readonly<Record<string, string>>,
        currentPassword: string,
        newPassword = 'a-new-password-123',
      ) =>
        fetch(url, {
          method: 'POST',
          headers: { origin: server.baseUrl, ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
      expect((await change({ origin: server.baseUrl }, 'administrator-password')).status).toBe(401);
      expect(
        (
          await change(
            { ...server.jsonHeaders, origin: 'https://untrusted.example' },
            'administrator-password',
          )
        ).status,
      ).toBe(403);
      expect((await change(server.jsonHeaders, 'wrong-password')).status).toBe(409);
      expect((await change(server.jsonHeaders, 'administrator-password', 'short')).status).toBe(
        400,
      );
      const changed = await change(server.jsonHeaders, 'administrator-password');
      expect(changed.status).toBe(204);
      expect(changed.headers.get('cache-control')).toContain('no-store');
      expect(changed.headers.getSetCookie()).toHaveLength(2);
      expect(
        (await fetch(`${server.baseUrl}/api/auth/account`, { headers: server.sessionHeaders }))
          .status,
      ).toBe(401);
      expect(
        (await fetch(`${server.baseUrl}/api/auth/account`, { headers: clientHeaders })).status,
      ).toBe(200);
      expect((await change(clientHeaders, 'portal-password-123')).status).toBe(204);
      expect(
        (await fetch(`${server.baseUrl}/api/auth/account`, { headers: clientHeaders })).status,
      ).toBe(401);
      const login = (email: string, password: string) =>
        fetch(`${server.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { origin: server.baseUrl, 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      expect(
        (await login(`${client.id.toLowerCase()}@portal.example.test`, 'a-new-password-123'))
          .status,
      ).toBe(200);
      expect((await login('administrator@example.test', 'a-new-password-123')).status).toBe(200);
      expect((await login('administrator@example.test', 'administrator-password')).status).toBe(
        401,
      );
      expect(server.output()).not.toContain('a-new-password-123');
    } finally {
      await server.close();
    }
  }, 20000);
});
