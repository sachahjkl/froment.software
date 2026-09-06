import {
  EmailTemplate,
  EmailTemplateContent,
  EmailTemplateConflict,
  EmailTemplateNotFound,
  EmailTemplateSave,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';

type Failure = EmailTemplateConflict | EmailTemplateNotFound | DatabaseError;
export class EmailTemplates extends Context.Service<
  EmailTemplates,
  {
    readonly list: Effect.Effect<ReadonlyArray<typeof EmailTemplate.Type>, Failure>;
    readonly save: (
      userId: string,
      id: string,
      request: typeof EmailTemplateSave.Type,
    ) => Effect.Effect<typeof EmailTemplate.Type, Failure>;
    readonly archive: (
      userId: string,
      id: string,
      expectedVersion: number,
    ) => Effect.Effect<void, Failure>;
  }
>()('@froment/api/EmailTemplates') {}

const Row = Schema.Struct({
  id: Schema.String,
  content: Schema.fromJsonString(EmailTemplateContent),
  version: Schema.Int,
  updatedAt: Schema.String,
});
const select = 'select id, content, version, updated_at as updatedAt from email_templates';
const decode = (row: typeof Row.Type) =>
  Schema.decodeUnknownSync(EmailTemplate)({
    ...row.content,
    id: row.id,
    version: row.version,
    updatedAt: row.updatedAt,
  });
const failure = (cause: unknown) =>
  cause instanceof EmailTemplateConflict || cause instanceof EmailTemplateNotFound
    ? cause
    : new DatabaseError({ operation: 'email.template', cause });

export const EmailTemplatesLive = Layer.effect(
  EmailTemplates,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const audit = yield* Audit;
    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Row))(
          sqlite.prepare(`${select} where archived = 0 order by updated_at desc, id desc`).all(),
        ).map(decode),
      catch: failure,
    });
    const save = Effect.fn('EmailTemplates.save')(function* (
      userId: string,
      id: string,
      request: typeof EmailTemplateSave.Type,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const updatedAt = DateTime.formatIso(DateTime.makeUnsafe(now));
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const content = Schema.decodeUnknownSync(EmailTemplateContent)(request);
              const existing = sqlite.prepare(`${select} where id = ? and archived = 0`).get(id);
              if (existing === undefined) {
                if (
                  request.expectedVersion !== 0 ||
                  sqlite.prepare('select 1 from email_templates where id = ?').get(id) !== undefined
                )
                  throw new EmailTemplateConflict({ code: 'email_template.conflict' });
                const count = Schema.decodeUnknownSync(Schema.Int)(
                  sqlite
                    .prepare('select count(*) from email_templates where archived = 0')
                    .pluck()
                    .get(),
                );
                if (count >= 100)
                  throw new EmailTemplateConflict({ code: 'email_template.conflict' });
                sqlite
                  .prepare(
                    'insert into email_templates (id, content, version, archived, updated_at, updated_by_user_id) values (?, ?, 1, 0, ?, ?)',
                  )
                  .run(id, JSON.stringify(content), updatedAt, userId);
              } else {
                const current = Schema.decodeUnknownSync(Row)(existing);
                if (
                  current.version === request.expectedVersion + 1 &&
                  isDeepStrictEqual(current.content, content)
                )
                  return decode(current);
                if (current.version !== request.expectedVersion)
                  throw new EmailTemplateConflict({ code: 'email_template.conflict' });
                sqlite
                  .prepare(
                    'update email_templates set content = ?, version = version + 1, updated_at = ?, updated_by_user_id = ? where id = ?',
                  )
                  .run(JSON.stringify(content), updatedAt, userId, id);
              }
              audit.insert({
                action: 'email.template-saved',
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
    const archive = Effect.fn('EmailTemplates.archive')(function* (
      userId: string,
      id: string,
      expectedVersion: number,
    ) {
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const existing = sqlite.prepare(`${select} where id = ?`).get(id);
              if (existing === undefined)
                throw new EmailTemplateNotFound({ code: 'email_template.not_found' });
              if (Schema.decodeUnknownSync(Row)(existing).version !== expectedVersion)
                throw new EmailTemplateConflict({ code: 'email_template.conflict' });
              if (
                sqlite
                  .prepare(
                    'update email_templates set archived = 1, updated_at = ?, updated_by_user_id = ? where id = ? and archived = 0',
                  )
                  .run(DateTime.formatIso(DateTime.makeUnsafe(now)), userId, id).changes !== 0
              )
                audit.insert({
                  action: 'email.template-archived',
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
    return EmailTemplates.of({ list, save, archive });
  }),
);
