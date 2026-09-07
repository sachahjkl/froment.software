import { TeamInviteResult, TeamList } from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { startHttpTestServer } from '../server/server.spec-helper.js';

it('keeps an older active invitation visible and cancellable after newer inactive invitations', async () => {
  const server = await startHttpTestServer();
  const sqlite = new Sqlite(server.databaseFilename);
  const headers = { ...server.jsonHeaders, origin: server.baseUrl };
  try {
    const response = await fetch(`${server.baseUrl}/api/team/invitations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestId: randomUUID(),
        email: 'active@example.test',
        displayName: 'Active member',
        profile: 'accountant',
      }),
    });
    expect(response.status).toBe(200);
    const { invitation } = Schema.decodeUnknownSync(TeamInviteResult)(await response.json());
    const actor = Schema.decodeUnknownSync(Schema.String)(
      sqlite
        .prepare('select created_by_user_id from team_invitations where id = ?')
        .pluck()
        .get(invitation.id),
    );
    const insert =
      sqlite.prepare(`insert into team_invitations (id, email, display_name, profile, token_hash, created_by_user_id, created_at, expires_at, cancelled_at, accepted_at)
      values (?, ?, 'Inactive member', 'accountant', ?, ?, ?, ?, ?, ?)`);
    sqlite
      .transaction(() => {
        for (let index = 0; index < 100; index++) {
          const id = randomUUID();
          const createdAt = invitation.createdAt + index + 1;
          const cancelledAt = index % 2 === 0 ? createdAt : null;
          const acceptedAt = index % 2 === 0 ? null : createdAt;
          insert.run(
            id,
            `inactive-${index}@example.test`,
            createHash('sha256').update(id).digest('hex'),
            actor,
            createdAt,
            invitation.expiresAt,
            cancelledAt,
            acceptedAt,
          );
        }
      })
      .immediate();
    const list = Schema.decodeUnknownSync(TeamList)(
      await (await fetch(`${server.baseUrl}/api/team`, { headers })).json(),
    );
    expect(list.invitations).toHaveLength(100);
    expect(list.invitations[0]?.id).toBe(invitation.id);
    expect(
      (
        await fetch(`${server.baseUrl}/api/team/invitations/${invitation.id}/cancel`, {
          method: 'POST',
          headers,
        })
      ).status,
    ).toBe(204);
    expect(
      sqlite
        .prepare('select cancelled_at from team_invitations where id = ?')
        .pluck()
        .get(invitation.id),
    ).not.toBeNull();
  } finally {
    sqlite.close();
    await server.close();
  }
}, 15000);
