import { CurrentAccount, CustomRole, TeamInviteResult, TeamList } from '@froment/contracts';
import { Schema } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CookieJar } from 'tough-cookie';
import Sqlite from 'better-sqlite3';

import { cookieHeaders, storeResponseCookies } from '../server/cookies.spec-helper.js';
import { startHttpTestServer, type HttpTestServer } from '../server/server.spec-helper.js';

describe('custom team roles', () => {
  let server: HttpTestServer;

  beforeAll(async () => {
    server = await startHttpTestServer();
  }, 30_000);
  afterAll(async () => server.close());

  it('assigns a custom role and applies later permission changes', async () => {
    const post = (path: string, body: typeof Schema.Json.Type, method: 'POST' | 'PUT' = 'POST') =>
      fetch(`${server.baseUrl}${path}`, {
        method,
        headers: server.jsonHeaders,
        body: JSON.stringify(body),
      });
    const roleResponse = await post('/api/roles', {
      requestId: crypto.randomUUID(),
      name: 'Custom sales reader',
      permissions: ['client.read'],
    });
    expect(roleResponse.status).toBe(200);
    const role = Schema.decodeUnknownSync(CustomRole)(await roleResponse.json());

    const invitationResponse = await post('/api/team/invitations', {
      requestId: crypto.randomUUID(),
      email: 'custom-role@example.test',
      displayName: 'Custom role member',
      profile: `custom:${role.id}`,
    });
    expect(invitationResponse.status).toBe(200);
    const invitation = Schema.decodeUnknownSync(TeamInviteResult)(await invitationResponse.json());
    expect(
      (
        await post('/api/team/accept', {
          token: new URL(invitation.url).hash.slice(1),
          password: 'custom-role-password-123',
        })
      ).status,
    ).toBe(204);

    const loginResponse = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { origin: server.baseUrl, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'custom-role@example.test',
        password: 'custom-role-password-123',
      }),
    });
    expect(loginResponse.status).toBe(200);
    const jar = new CookieJar();
    await storeResponseCookies(jar, loginResponse, server.baseUrl);
    const memberHeaders = await cookieHeaders(jar, `${server.baseUrl}/api`);
    const account = Schema.decodeUnknownSync(CurrentAccount)(
      await (await fetch(`${server.baseUrl}/api/auth/account`, { headers: memberHeaders })).json(),
    );
    expect(account.permissions).toEqual(['client.read']);

    const updateResponse = await post(
      `/api/roles/${role.id}`,
      {
        name: role.name,
        permissions: ['client.read', 'supplier.read'],
        expectedVersion: role.version,
      },
      'PUT',
    );
    expect(updateResponse.status).toBe(200);
    const updatedRole = Schema.decodeUnknownSync(CustomRole)(await updateResponse.json());
    const changedAccount = Schema.decodeUnknownSync(CurrentAccount)(
      await (await fetch(`${server.baseUrl}/api/auth/account`, { headers: memberHeaders })).json(),
    );
    expect(changedAccount.permissions).toEqual(['client.read', 'supplier.read']);

    const elevatedResponse = await post(
      `/api/roles/${role.id}`,
      {
        name: role.name,
        permissions: ['client.read', 'supplier.read', 'user.update'],
        expectedVersion: updatedRole.version,
      },
      'PUT',
    );
    expect(elevatedResponse.status).toBe(200);
    const elevatedRole = Schema.decodeUnknownSync(CustomRole)(await elevatedResponse.json());
    const sqlite = new Sqlite(server.databaseFilename);
    sqlite
      .prepare(
        `delete from role_permissions where permission_code = 'user.update'
         and role_id = (select id from roles where name = 'administrator')`,
      )
      .run();
    const lastAdministratorResponse = await post(
      `/api/roles/${role.id}`,
      {
        name: role.name,
        permissions: ['client.read', 'supplier.read'],
        expectedVersion: elevatedRole.version,
      },
      'PUT',
    );
    expect(lastAdministratorResponse.status).toBe(409);
    await expect(lastAdministratorResponse.json()).resolves.toMatchObject({
      code: 'role.last_administrator',
    });
    sqlite
      .prepare(
        `insert into role_permissions (role_id, permission_code)
         select id, 'user.update' from roles where name = 'administrator'`,
      )
      .run();
    sqlite.close();

    const inUseResponse = await fetch(`${server.baseUrl}/api/roles/${role.id}`, {
      method: 'DELETE',
      headers: server.jsonHeaders,
    });
    expect(inUseResponse.status).toBe(409);
    await expect(inUseResponse.json()).resolves.toMatchObject({ code: 'role.in_use' });

    const team = Schema.decodeUnknownSync(TeamList)(
      await (await fetch(`${server.baseUrl}/api/team`, { headers: server.sessionHeaders })).json(),
    );
    expect(team.roles).toHaveLength(1);
    const member = team.members[0];
    if (!member) throw new Error('team.test.member_missing');
    expect(
      (
        await post(
          `/api/team/members/${member.id}`,
          { expectedVersion: member.version, profile: 'collaborator', disabled: false },
          'PUT',
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await fetch(`${server.baseUrl}/api/roles/${role.id}`, {
          method: 'DELETE',
          headers: server.jsonHeaders,
        })
      ).status,
    ).toBe(204);
  });
});
