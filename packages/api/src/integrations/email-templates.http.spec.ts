import { EmailTemplate, EmailTemplateList } from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('persists shared templates with version checks, idempotent retries, archival, and no email submission', async () => {
  const server = await startHttpTestServer();
  const database = new Sqlite(server.databaseFilename);
  const id = randomUUID();
  const url = `${server.baseUrl}/api/email-templates/${id}`;
  const content = { subject: 'Reminder', body: '<script>literal</script>\n{{not-evaluated}}' };
  const save = (request: typeof Schema.Json.Type) =>
    fetch(url, { method: 'PUT', headers: server.jsonHeaders, body: JSON.stringify(request) });
  const list = async () =>
    Schema.decodeUnknownSync(EmailTemplateList)(
      await (
        await fetch(`${server.baseUrl}/api/email-templates`, { headers: server.sessionHeaders })
      ).json(),
    );
  try {
    expect((await fetch(`${server.baseUrl}/api/email-templates`)).status).toBe(401);
    const client = await createClient(server);
    const session = await createClientSession(server, client.id);
    expect(
      (await fetch(`${server.baseUrl}/api/email-templates`, { headers: session })).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: 'PUT',
          headers: { ...session, 'content-type': 'application/json' },
          body: JSON.stringify({ ...content, expectedVersion: 0 }),
        })
      ).status,
    ).toBe(403);
    expect((await save({ ...content, subject: ' ', expectedVersion: 0 })).status).toBe(400);
    const created = await save({ ...content, expectedVersion: 0 });
    expect(created.status).toBe(200);
    expect(Schema.decodeUnknownSync(EmailTemplate)(await created.json())).toMatchObject({
      ...content,
      id,
      version: 1,
    });
    expect((await save({ ...content, expectedVersion: 0 })).status).toBe(200);
    expect(await list()).toHaveLength(1);
    expect((await save({ ...content, body: 'New text', expectedVersion: 1 })).status).toBe(200);
    expect((await save({ ...content, expectedVersion: 1 })).status).toBe(409);
    expect(
      (
        await fetch(`${url}/archive`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({ expectedVersion: 1 }),
        })
      ).status,
    ).toBe(409);
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        (
          await fetch(`${url}/archive`, {
            method: 'POST',
            headers: server.jsonHeaders,
            body: JSON.stringify({ expectedVersion: 2 }),
          })
        ).status,
      ).toBe(204);
    expect(await list()).toEqual([]);
    expect((await save({ ...content, expectedVersion: 0 })).status).toBe(409);
    expect(
      database.prepare('select content from email_templates where id = ?').pluck().get(id),
    ).toBe(JSON.stringify({ subject: content.subject, body: 'New text' }));
    expect(database.prepare('select count(*) from integration_operations').pluck().get()).toBe(0);
    const insert = database.prepare(
      'insert into email_templates (id, content, version, archived, updated_at, updated_by_user_id) select ?, content, 1, 0, updated_at, updated_by_user_id from email_templates where id = ?',
    );
    for (let index = 0; index < 100; index++) insert.run(randomUUID(), id);
    expect(
      (
        await fetch(`${server.baseUrl}/api/email-templates/${randomUUID()}`, {
          method: 'PUT',
          headers: server.jsonHeaders,
          body: JSON.stringify({ ...content, expectedVersion: 0 }),
        })
      ).status,
    ).toBe(409);
  } finally {
    database.close();
    await server.close();
  }
}, 20000);
