import {
  EmailTestAddress,
  EmailTestConflict,
  EmailTestOperation,
  EmailTestRequest,
  IntegrationInvalid,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schedule, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { EmailTransport } from './email-transport.js';

const Row = Schema.Struct({
  ...EmailTestOperation.fields,
  request: Schema.fromJsonString(EmailTestRequest),
  nextAttemptAt: Schema.NullOr(Schema.Int),
  accountKey: Schema.NullOr(Schema.String),
});
const select = `select request, created_by_user_id as createdByUserId, created_at as createdAt,
  updated_at as updatedAt, status, attempts, next_attempt_at as nextAttemptAt,
  provider_id as providerId, error, account_key as accountKey from email_tests`;
const iso = (time: number) => DateTime.formatIso(DateTime.makeUnsafe(time));
const publicOperation = ({
  accountKey: _accountKey,
  ...row
}: typeof Row.Type): EmailTestOperation => ({
  ...row,
  nextAttemptAt: row.nextAttemptAt === null ? null : iso(row.nextAttemptAt),
});
const databaseError = (cause: unknown) => new DatabaseError({ operation: 'email.test', cause });

const makeEmailTests = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const transport = yield* EmailTransport;
  const read = (requestId: string) =>
    Schema.decodeUnknownSync(Row)(sqlite.prepare(`${select} where request_id = ?`).get(requestId));
  const allowed = (userId: string) =>
    sqlite
      .prepare(`select 1 from users u
    join user_roles ur on ur.user_id = u.id join role_permissions rp on rp.role_id = ur.role_id
    where u.id = ? and u.disabled_at is null and u.kind = 'administrator' and rp.permission_code = 'integration.configure'`)
      .get(userId) !== undefined;
  const list = Effect.fn('EmailTests.list')(() =>
    Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Row))(
          sqlite.prepare(`${select} order by created_at desc, request_id desc limit 100`).all(),
        ).map(publicOperation),
      catch: databaseError,
    }),
  );
  const enqueue = Effect.fn('EmailTests.enqueue')(function* (
    request: EmailTestRequest,
    actorUserId: string,
  ) {
    if (!Schema.is(EmailTestRequest)(request))
      return yield* new IntegrationInvalid({ code: 'integration.invalid_request' });
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (!allowed(actorUserId)) throw new EmailTestConflict({ code: 'emailTest.conflict' });
            const exists = sqlite
              .prepare('select 1 from email_tests where request_id = ?')
              .get(request.requestId);
            if (exists !== undefined) {
              const operation = read(request.requestId);
              if (
                !isDeepStrictEqual(operation.request, request) ||
                operation.createdByUserId !== actorUserId
              )
                throw new EmailTestConflict({ code: 'emailTest.conflict' });
              return publicOperation(operation);
            }
            if (
              sqlite
                .prepare(
                  "select 1 from email_tests where status in ('queued', 'sending', 'retrying')",
                )
                .get() !== undefined
            )
              throw new EmailTestConflict({ code: 'emailTest.active' });
            if (
              Schema.decodeUnknownSync(Schema.Int)(
                sqlite.prepare('select count(*) from email_tests').pluck().get(),
              ) >= 100
            )
              throw new EmailTestConflict({ code: 'emailTest.limit' });
            sqlite
              .prepare(`insert into email_tests (request_id, request, created_by_user_id, created_at, updated_at, status, attempts, next_attempt_at, account_key)
          values (?, ?, ?, ?, ?, 'queued', 0, ?, ?)`)
              .run(
                request.requestId,
                JSON.stringify(request),
                actorUserId,
                iso(now),
                iso(now),
                now,
                transport.accountKey,
              );
            audit.insert({
              action: 'integration.requested',
              actorUserId,
              resourceType: 'integration',
              resourceId: request.requestId,
              metadata: { provider: 'resend', operation: 'email-test' },
              occurredAt: now,
            });
            return publicOperation(read(request.requestId));
          })
          .immediate(),
      catch: (cause) => (cause instanceof EmailTestConflict ? cause : databaseError(cause)),
    });
  });
  const process = Effect.fn('EmailTests.process')(function* (requestId: string) {
    const now = yield* Clock.currentTimeMillis;
    const job = yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const row = read(requestId);
            if (row.nextAttemptAt === null || row.nextAttemptAt > now) return undefined;
            if (row.status === 'accepted') {
              if (
                !allowed(row.createdByUserId) ||
                transport.accountKey !== row.accountKey ||
                now - DateTime.toEpochMillis(DateTime.makeUnsafe(row.createdAt)) >= 86400000
              ) {
                sqlite
                  .prepare(
                    'update email_tests set next_attempt_at = null, error = ? where request_id = ?',
                  )
                  .run('emailTest.statusUnavailable', requestId);
                return undefined;
              }
              sqlite
                .prepare('update email_tests set next_attempt_at = ? where request_id = ?')
                .run(now + 120000, requestId);
              return row;
            }
            if (!['queued', 'retrying', 'sending'].includes(row.status)) return undefined;
            const error = !allowed(row.createdByUserId)
              ? 'emailTest.permissionRevoked'
              : transport.accountKey === null
                ? 'emailTest.credentialsMissing'
                : transport.accountKey !== row.accountKey
                  ? 'emailTest.credentialsChanged'
                  : now - DateTime.toEpochMillis(DateTime.makeUnsafe(row.createdAt)) >=
                      23 * 60 * 60 * 1000
                    ? 'emailTest.expired'
                    : row.attempts >= 5
                      ? 'emailTest.unavailable'
                      : null;
            if (error !== null) {
              sqlite
                .prepare(
                  "update email_tests set status = 'blocked', error = ?, updated_at = ?, next_attempt_at = null where request_id = ?",
                )
                .run(error, iso(now), requestId);
              audit.insert({
                action: 'integration.processed',
                actorUserId: row.createdByUserId,
                resourceType: 'integration',
                resourceId: requestId,
                metadata: { operation: 'email-test', error },
                occurredAt: now,
              });
              return undefined;
            }
            sqlite
              .prepare(
                "update email_tests set status = 'sending', attempts = attempts + 1, updated_at = ?, next_attempt_at = ?, error = null where request_id = ?",
              )
              .run(iso(now), now + 120000, requestId);
            return read(requestId);
          })
          .immediate(),
      catch: databaseError,
    });
    if (job === undefined) return;
    if (job.status === 'accepted') {
      if (job.providerId === null) return;
      const outcome = yield* transport.delivery(job.providerId).pipe(
        Effect.map((status) => ({ status, error: null })),
        Effect.catch(() =>
          Effect.succeed({
            status: 'accepted' as const,
            error: 'emailTest.statusUnavailable' as const,
          }),
        ),
      );
      const finished = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () => {
          const nextAttemptAt =
            outcome.status === 'accepted' &&
            finished - DateTime.toEpochMillis(DateTime.makeUnsafe(job.createdAt)) < 86400000
              ? finished + (outcome.error === null ? 15000 : 300000)
              : null;
          sqlite
            .prepare(
              "update email_tests set status = ?, error = ?, updated_at = ?, next_attempt_at = ? where request_id = ? and status = 'accepted'",
            )
            .run(outcome.status, outcome.error, iso(finished), nextAttemptAt, requestId);
        },
        catch: databaseError,
      });
      return;
    }
    const outcome = yield* transport
      .send({ ...job.request, ...EmailTestAddress, subject: `[Test] ${job.request.subject}` })
      .pipe(
        Effect.map((providerId) => ({ status: 'accepted' as const, providerId, error: null })),
        Effect.catch((error) =>
          Effect.succeed({
            status:
              error.retryable && job.attempts < 5 ? ('retrying' as const) : ('failed' as const),
            providerId: null,
            error: error.code,
          }),
        ),
      );
    const finished = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const nextAttemptAt =
              outcome.status === 'retrying'
                ? finished + 60000 * 2 ** job.attempts
                : outcome.status === 'accepted'
                  ? finished + 15000
                  : null;
            const changed = sqlite
              .prepare(
                "update email_tests set status = ?, provider_id = ?, error = ?, updated_at = ?, next_attempt_at = ? where request_id = ? and status = 'sending' and attempts = ?",
              )
              .run(
                outcome.status,
                outcome.providerId,
                outcome.error,
                iso(finished),
                nextAttemptAt,
                requestId,
                job.attempts,
              ).changes;
            if (changed > 0)
              audit.insert({
                action: 'integration.processed',
                actorUserId: job.createdByUserId,
                resourceType: 'integration',
                resourceId: requestId,
                metadata: {
                  operation: 'email-test',
                  status: outcome.status,
                  attempts: String(job.attempts),
                },
                occurredAt: finished,
              });
          })
          .immediate(),
      catch: databaseError,
    });
  });
  const runPending = Effect.fn('EmailTests.runPending')(function* () {
    const now = yield* Clock.currentTimeMillis;
    const ids = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Schema.String))(
          sqlite
            .prepare(
              'select request_id from email_tests where next_attempt_at <= ? order by next_attempt_at, request_id limit 10',
            )
            .pluck()
            .all(now),
        ),
      catch: databaseError,
    });
    yield* Effect.forEach(ids, process, { discard: true });
  });
  return { list, enqueue, runPending };
});

export class EmailTests extends Context.Service<
  EmailTests,
  Effect.Success<typeof makeEmailTests>
>()('@froment/api/EmailTests') {}
export const EmailTestsLive = Layer.effect(EmailTests, makeEmailTests);
export const EmailTestWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const tests = yield* EmailTests;
    yield* tests.runPending().pipe(
      Effect.catch((error) => Effect.logError('email.test.worker_failed', error)),
      Effect.repeat(Schedule.spaced('3 seconds')),
      Effect.forkScoped,
    );
  }),
);
