import {
  EmailDraft,
  EmailDraftContent,
  EmailDraftConflict,
  EmailDraftNotFound,
  EmailDraftSave,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';

type Failure = EmailDraftConflict | EmailDraftNotFound | DatabaseError;
export class EmailDrafts extends Context.Service<
  EmailDrafts,
  {
    readonly list: (
      userId: string,
    ) => Effect.Effect<ReadonlyArray<typeof EmailDraft.Type>, Failure>;
    readonly save: (
      userId: string,
      id: string,
      request: typeof EmailDraftSave.Type,
    ) => Effect.Effect<typeof EmailDraft.Type, Failure>;
    readonly archive: (
      userId: string,
      id: string,
      expectedVersion: number,
    ) => Effect.Effect<void, Failure>;
  }
>()('@froment/api/EmailDrafts') {}

const Row = Schema.Struct({
  id: Schema.String,
  content: Schema.fromJsonString(EmailDraftContent),
  version: Schema.Int,
  updatedAt: Schema.String,
});
const select = 'select id, content, version, updated_at as updatedAt from email_drafts';
const decode = (row: typeof Row.Type) =>
  Schema.decodeUnknownSync(EmailDraft)({
    ...row.content,
    id: row.id,
    version: row.version,
    updatedAt: row.updatedAt,
  });
const failure = (cause: unknown) => {
  if (cause instanceof EmailDraftConflict || cause instanceof EmailDraftNotFound) return cause;
  return new DatabaseError({ operation: 'email.draft', cause });
};

export const EmailDraftsLive = Layer.effect(
  EmailDrafts,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const audit = yield* Audit;
    const list = Effect.fn('EmailDrafts.list')((userId: string) =>
      Effect.try({
        try: () =>
          Schema.decodeUnknownSync(Schema.Array(Row))(
            sqlite
              .prepare(`${select} where user_id = ? and archived = 0
      and not exists (select 1 from integration_operations where request_id = email_drafts.id)
      order by updated_at desc, id desc`)
              .all(userId),
          ).map(decode),
        catch: failure,
      }),
    );
    const save = Effect.fn('EmailDrafts.save')(function* (
      userId: string,
      id: string,
      request: typeof EmailDraftSave.Type,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const content = Schema.decodeUnknownSync(EmailDraftContent)(request);
      const updatedAt = DateTime.formatIso(DateTime.makeUnsafe(now));
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const existing = sqlite
                .prepare(`${select} where id = ? and user_id = ? and archived = 0`)
                .get(id, userId);
              if (
                sqlite
                  .prepare('select 1 from integration_operations where request_id = ?')
                  .get(id) !== undefined
              )
                throw new EmailDraftConflict({ code: 'email_draft.conflict' });
              if (existing === undefined) {
                if (
                  request.expectedVersion !== 0 ||
                  sqlite.prepare('select 1 from email_drafts where id = ?').get(id) !== undefined
                )
                  throw new EmailDraftConflict({ code: 'email_draft.conflict' });
                const count = Schema.decodeUnknownSync(Schema.Int)(
                  sqlite
                    .prepare('select count(*) from email_drafts where user_id = ? and archived = 0')
                    .pluck()
                    .get(userId),
                );
                if (count >= 100) throw new EmailDraftConflict({ code: 'email_draft.conflict' });
                sqlite
                  .prepare(
                    'insert into email_drafts (id, user_id, content, version, archived, updated_at) values (?, ?, ?, 1, 0, ?)',
                  )
                  .run(id, userId, JSON.stringify(content), updatedAt);
              } else {
                const current = Schema.decodeUnknownSync(Row)(existing);
                if (
                  current.version === request.expectedVersion + 1 &&
                  isDeepStrictEqual(current.content, content)
                )
                  return decode(current);
                if (current.version !== request.expectedVersion)
                  throw new EmailDraftConflict({ code: 'email_draft.conflict' });
                sqlite
                  .prepare(
                    'update email_drafts set content = ?, version = version + 1, updated_at = ? where id = ?',
                  )
                  .run(JSON.stringify(content), updatedAt, id);
              }
              audit.insert({
                action: 'email.draft-saved',
                actorUserId: userId,
                resourceType: 'integration',
                resourceId: id,
                occurredAt: now,
              });
              return decode(
                Schema.decodeUnknownSync(Row)(sqlite.prepare(`${select} where id = ?`).get(id)),
              );
            })
            .immediate(),
        catch: failure,
      });
    });
    const archive = Effect.fn('EmailDrafts.archive')(function* (
      userId: string,
      id: string,
      expectedVersion: number,
    ) {
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const existing = sqlite
                .prepare(`${select} where id = ? and user_id = ?`)
                .get(id, userId);
              if (existing === undefined)
                throw new EmailDraftNotFound({ code: 'email_draft.not_found' });
              if (Schema.decodeUnknownSync(Row)(existing).version !== expectedVersion)
                throw new EmailDraftConflict({ code: 'email_draft.conflict' });
              if (
                sqlite
                  .prepare('update email_drafts set archived = 1 where id = ? and archived = 0')
                  .run(id).changes !== 0
              )
                audit.insert({
                  action: 'email.draft-archived',
                  actorUserId: userId,
                  resourceType: 'integration',
                  resourceId: id,
                  occurredAt: now,
                });
            })
            .immediate(),
        catch: failure,
      });
    });
    return EmailDrafts.of({ list, save, archive });
  }),
);
