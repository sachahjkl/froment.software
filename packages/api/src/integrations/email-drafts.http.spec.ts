import { EmailDraft, EmailDraftContent, EmailDraftList } from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('persists incomplete private drafts, rejects stale edits, and seals each submitted draft under its stable request key', async () => {
  const server = await startHttpTestServer();
  const database = new Sqlite(server.databaseFilename);
  const id = randomUUID();
  const url = `${server.baseUrl}/api/email-drafts/${id}`;
  const content = { recipient: '', subject: '', reference: '', body: 'Unfinished', reminder: true };
  const save = (request: typeof Schema.Json.Type) =>
    fetch(url, { method: 'PUT', headers: server.jsonHeaders, body: JSON.stringify(request) });
  const list = async () =>
    Schema.decodeUnknownSync(EmailDraftList)(
      await (
        await fetch(`${server.baseUrl}/api/email-drafts`, { headers: server.sessionHeaders })
      ).json(),
    );
  try {
    expect((await fetch(`${server.baseUrl}/api/email-drafts`)).status).toBe(401);
    const client = await createClient(server);
    const clientSession = await createClientSession(server, client.id);
    expect(
      (await fetch(`${server.baseUrl}/api/email-drafts`, { headers: clientSession })).status,
    ).toBe(403);
    const created = await save({ ...content, expectedVersion: 0 });
    expect(created.status).toBe(200);
    expect(Schema.decodeUnknownSync(EmailDraft)(await created.json())).toMatchObject({
      ...content,
      id,
      version: 1,
    });
    expect((await save({ ...content, expectedVersion: 0 })).status).toBe(200);
    expect(await list()).toHaveLength(1);
    const complete = {
      ...content,
      recipient: 'client@example.test',
      subject: 'Payment reminder',
      reference: 'FA-2026-000001',
      body: 'Please review the remaining balance.',
    };
    expect((await save({ ...complete, expectedVersion: 1 })).status).toBe(200);
    expect((await save({ ...content, expectedVersion: 1 })).status).toBe(409);
    const owner = database.prepare('select user_id from email_drafts where id = ?').pluck().get(id);
    database.prepare('update email_drafts set user_id = ? where id = ?').run(client.id, id);
    expect(await list()).toEqual([]);
    expect((await save({ ...complete, expectedVersion: 2 })).status).toBe(409);
    expect(
      (
        await fetch(`${url}/archive`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({ expectedVersion: 2 }),
        })
      ).status,
    ).toBe(404);
    database.prepare('update email_drafts set user_id = ? where id = ?').run(owner, id);
    const request = {
      kind: 'email',
      requestId: id,
      expectedMode: 'simulation',
      recipient: complete.recipient,
      subject: complete.subject,
      reference: complete.reference,
      body: complete.body,
    };
    const send = (body: string) =>
      fetch(`${server.baseUrl}/api/integrations/operations`, {
        method: 'POST',
        headers: { ...server.jsonHeaders, origin: server.baseUrl },
        body,
      });
    expect((await send(JSON.stringify({ ...request, body: 'Stale text' }))).status).toBe(409);
    const sent = await send(JSON.stringify(request));
    expect(sent.status).toBe(200);
    const operation = await sent.json();
    expect(operation).toMatchObject({ receipt: { mode: 'simulation', status: 'simulated' } });
    expect(await (await send(JSON.stringify(request))).json()).toEqual(operation);
    expect(await list()).toEqual([]);
    expect((await save({ ...complete, expectedVersion: 2 })).status).toBe(409);
    expect(
      database
        .prepare('select count(*) from integration_operations where request_id = ?')
        .pluck()
        .get(id),
    ).toBe(1);
    expect(
      Schema.decodeUnknownSync(Schema.fromJsonString(EmailDraftContent))(
        database.prepare('select content from email_drafts where id = ?').pluck().get(id),
      ),
    ).toEqual(complete);
    const archivedId = randomUUID();
    const archivedUrl = `${server.baseUrl}/api/email-drafts/${archivedId}`;
    expect(
      (
        await fetch(archivedUrl, {
          method: 'PUT',
          headers: server.jsonHeaders,
          body: JSON.stringify({ ...content, expectedVersion: 0 }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${archivedUrl}/archive`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({ expectedVersion: 1 }),
        })
      ).status,
    ).toBe(204);
    expect(await list()).toEqual([]);
    expect(database.prepare('select count(*) from email_drafts').pluck().get()).toBe(2);
  } finally {
    database.close();
    await server.close();
  }
}, 20000);
