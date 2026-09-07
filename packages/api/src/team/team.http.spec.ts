import {
  ApiTokenCreated,
  TeamInviteResult,
  TeamList,
  TeamProfilePermissions,
  type TeamInvite,
} from '@froment/contracts';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import Sqlite from 'better-sqlite3';
import { CookieJar } from 'tough-cookie';
import { expect, it } from 'vitest';
import {
  startHttpTestServer,
  createClient,
  createClientSession,
} from '../server/server.spec-helper.js';
import { cookieHeaders, storeResponseCookies } from '../server/cookies.spec-helper.js';

it('creates single-use team invitations and enforces profiles, version checks and session revocation', async () => {
  const server = await startHttpTestServer();
  const sqlite = new Sqlite(server.databaseFilename);
  const password = 'team-member-password-123';
  const post = (
    path: string,
    body: typeof Schema.Json.Type,
    headers = server.sessionHeaders,
    method: 'POST' | 'PUT' = 'POST',
  ) =>
    fetch(`${server.baseUrl}${path}`, {
      method,
      headers: { ...headers, origin: server.baseUrl, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const list = async () =>
    Schema.decodeUnknownSync(TeamList)(
      await (await fetch(`${server.baseUrl}/api/team`, { headers: server.sessionHeaders })).json(),
    );
  const login = async (email: string) => {
    const response = await post('/api/auth/login', { email, password }, {});
    expect(response.status).toBe(200);
    const jar = new CookieJar();
    await storeResponseCookies(jar, response, server.baseUrl);
    return cookieHeaders(jar, `${server.baseUrl}/api`);
  };
  try {
    expect((await fetch(`${server.baseUrl}/api/team`)).status).toBe(401);
    const request: typeof TeamInvite.Type = {
      requestId: randomUUID(),
      email: 'Accountant@example.test',
      displayName: 'Accountant',
      profile: 'accountant',
    };
    const response = await post('/api/team/invitations', request);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const invitation = Schema.decodeUnknownSync(TeamInviteResult)(await response.json());
    expect(invitation.invitation.email).toBe('accountant@example.test');
    expect(
      Schema.decodeUnknownSync(TeamInviteResult)(
        await (await post('/api/team/invitations', request)).json(),
      ),
    ).toEqual(invitation);
    const changed = await post('/api/team/invitations', { ...request, profile: 'collaborator' });
    expect(changed.status).toBe(409);
    expect(await changed.json()).toEqual({ _tag: 'TeamConflict', code: 'team.invitation_changed' });
    const duplicate = await post('/api/team/invitations', { ...request, requestId: randomUUID() });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({
      _tag: 'TeamConflict',
      code: 'team.invitation_exists',
    });
    const token = new URL(invitation.url).hash.slice(1);
    expect(JSON.stringify(await list())).not.toContain(token);
    expect(JSON.stringify(sqlite.prepare('select * from team_invitations').all())).not.toContain(
      token,
    );
    expect(
      (
        await fetch(`${server.baseUrl}/api/team/accept`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
          body: JSON.stringify({ token, password }),
        })
      ).status,
    ).toBe(403);
    const accepted = await Promise.all([
      post('/api/team/accept', { token, password }, {}),
      post('/api/team/accept', { token, password }, {}),
    ]);
    expect(accepted.map((item) => item.status).sort()).toEqual([204, 409]);
    expect((await post('/api/team/accept', { token, password }, {})).status).toBe(409);
    const existingAccount = await post('/api/team/invitations', {
      ...request,
      requestId: randomUUID(),
    });
    expect(existingAccount.status).toBe(409);
    expect(await existingAccount.json()).toEqual({
      _tag: 'TeamConflict',
      code: 'team.email_exists',
    });
    const consumed = await post('/api/team/invitations', request);
    expect(consumed.status).toBe(409);
    expect(await consumed.json()).toEqual({
      _tag: 'TeamConflict',
      code: 'team.invitation_inactive',
    });
    let headers = await login('accountant@example.test');
    expect((await fetch(`${server.baseUrl}/api/invoices`, { headers })).status).toBe(200);
    expect((await fetch(`${server.baseUrl}/api/banking/transactions`, { headers })).status).toBe(
      200,
    );
    expect((await fetch(`${server.baseUrl}/api/team`, { headers })).status).toBe(403);
    expect(
      (
        await post(
          '/api/team/invitations',
          { ...request, requestId: randomUUID(), email: 'other@example.test' },
          headers,
        )
      ).status,
    ).toBe(403);
    expect((await post('/api/clients', { displayName: 'No', email: '' }, headers)).status).toBe(
      403,
    );
    const member = (await list()).members[0];
    if (member === undefined) throw new Error('team.test.member_missing');
    const permissions = () =>
      Schema.decodeUnknownSync(Schema.Array(Schema.String))(
        sqlite
          .prepare(
            'select rp.permission_code from user_roles ur join role_permissions rp on rp.role_id = ur.role_id where ur.user_id = ? order by rp.permission_code',
          )
          .pluck()
          .all(member.id),
      );
    expect(permissions()).toEqual([...TeamProfilePermissions.accountant].sort());
    expect(
      (
        await post(
          `/api/team/members/${member.id}`,
          { expectedVersion: 1, profile: 'administrator', disabled: false },
          server.sessionHeaders,
          'PUT',
        )
      ).status,
    ).toBe(400);
    const update = { expectedVersion: member.version, profile: 'collaborator', disabled: false };
    expect(
      (await post(`/api/team/members/${member.id}`, update, server.sessionHeaders, 'PUT')).status,
    ).toBe(204);
    expect(
      (await post(`/api/team/members/${member.id}`, update, server.sessionHeaders, 'PUT')).status,
    ).toBe(204);
    expect(
      (
        await post(
          `/api/team/members/${member.id}`,
          { ...update, disabled: true },
          server.sessionHeaders,
          'PUT',
        )
      ).status,
    ).toBe(409);
    expect((await fetch(`${server.baseUrl}/api/invoices`, { headers })).status).toBe(401);
    headers = await login(member.email);
    expect(permissions()).toEqual([...TeamProfilePermissions.collaborator].sort());
    expect((await fetch(`${server.baseUrl}/api/team`, { headers })).status).toBe(403);
    expect(
      (
        await post(
          '/api/banking/import',
          {
            account: 'TEAM',
            csv: 'transaction_id,booked_on,amount,currency,description\nTEAM-1,2026-09-01,10.00,EUR,Test',
          },
          headers,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          `/api/team/members/${member.id}`,
          { expectedVersion: 2, profile: 'accountant', disabled: true },
          server.sessionHeaders,
          'PUT',
        )
      ).status,
    ).toBe(204);
    expect((await fetch(`${server.baseUrl}/api/invoices`, { headers })).status).toBe(401);
    expect(
      (
        await post(
          `/api/team/members/${member.id}`,
          { expectedVersion: 3, profile: 'accountant', disabled: false },
          server.sessionHeaders,
          'PUT',
        )
      ).status,
    ).toBe(204);
    headers = await login(member.email);
    expect((await post('/api/banking/import', { account: 'TEAM', csv: '' }, headers)).status).toBe(
      403,
    );
    const client = await createClient(server);
    const clientHeaders = await createClientSession(server, client.id);
    expect((await fetch(`${server.baseUrl}/api/team`, { headers: clientHeaders })).status).toBe(
      403,
    );
    const adminId = Schema.decodeUnknownSync(Schema.String)(
      sqlite
        .prepare(
          "select user_id from password_credentials where email = 'administrator@example.test'",
        )
        .pluck()
        .get(),
    );
    expect(
      (
        await post(
          `/api/team/members/${adminId}`,
          { expectedVersion: 1, profile: 'accountant', disabled: true },
          server.sessionHeaders,
          'PUT',
        )
      ).status,
    ).toBe(409);
    expect(
      sqlite.prepare("select count(*) from audit_events where action like 'team.%'").pluck().get(),
    ).toBeGreaterThan(3);
    expect(server.output()).not.toContain(token);
    const apiToken = Schema.decodeUnknownSync(ApiTokenCreated)(
      await (
        await post('/api/tokens', {
          name: 'Team API access denied',
          permissions: ['client.read'],
          expiresAt: Date.now() + 86400000,
          rateLimitPerMinute: 60,
        })
      ).json(),
    );
    expect(
      (
        await fetch(`${server.baseUrl}/api/team`, {
          headers: { authorization: `Bearer ${apiToken.secret}` },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post(
          `/api/team/members/${member.id}`,
          { expectedVersion: 4, profile: 'accountant', disabled: true },
          server.sessionHeaders,
          'PUT',
        )
      ).status,
    ).toBe(204);
    expect((await post('/api/auth/login', { email: member.email, password }, {})).status).toBe(401);
  } finally {
    sqlite.close();
    await server.close();
  }
}, 30000);

it('rejects cancelled, expired and unauthorized invitations without changing accounts', async () => {
  const server = await startHttpTestServer();
  const sqlite = new Sqlite(server.databaseFilename);
  const post = (path: string, body: typeof Schema.Json.Type, authenticated = true) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        cookie: authenticated ? (server.sessionHeaders['cookie'] ?? '') : '',
        origin: server.baseUrl,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  try {
    for (const condition of ['cancelled', 'expired', 'permission']) {
      const response = await post('/api/team/invitations', {
        requestId: randomUUID(),
        email: `${condition}@example.test`,
        displayName: condition,
        profile: 'accountant',
      });
      const invitation = Schema.decodeUnknownSync(TeamInviteResult)(await response.json());
      if (condition === 'cancelled') {
        expect(
          (await post(`/api/team/invitations/${invitation.invitation.id}/cancel`, {})).status,
        ).toBe(204);
        expect(
          (await post(`/api/team/invitations/${invitation.invitation.id}/cancel`, {})).status,
        ).toBe(204);
      } else if (condition === 'expired')
        sqlite
          .prepare('update team_invitations set expires_at = created_at where id = ?')
          .run(invitation.invitation.id);
      else
        sqlite.prepare("delete from role_permissions where permission_code = 'user.create'").run();
      expect(
        (
          await post(
            '/api/team/accept',
            { token: new URL(invitation.url).hash.slice(1), password: 'invitation-password-123' },
            false,
          )
        ).status,
      ).toBe(409);
    }
    expect(sqlite.prepare('select count(*) from team_members').pluck().get()).toBe(0);
    expect(sqlite.prepare('pragma foreign_key_check').all()).toEqual([]);
  } finally {
    sqlite.close();
    await server.close();
  }
}, 25000);
