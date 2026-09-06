import { IntegrationRetry, IntegrationSubmission } from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schedule, Schema } from 'effect';
import { Database, DatabaseError } from '../database/database.js';
import { Integrations } from './service.js';

const Row = Schema.Struct({
  operationId: Schema.String,
  attempts: Schema.Int,
  status: IntegrationRetry.fields.status,
  nextAttemptAt: Schema.Int,
  error: IntegrationRetry.fields.error,
});
const Job = Schema.Struct({
  ...Row.fields,
  request: Schema.fromJsonString(IntegrationSubmission),
  userId: Schema.String,
});
const select =
  'select operation_id as operationId, attempts, status, next_attempt_at as nextAttemptAt, error from integration_retries';
const databaseFailure = (cause: unknown) =>
  new DatabaseError({ operation: 'integration.retry', cause });

export class IntegrationRetries extends Context.Service<
  IntegrationRetries,
  {
    readonly list: Effect.Effect<ReadonlyArray<typeof IntegrationRetry.Type>, DatabaseError>;
    readonly runPending: Effect.Effect<void, DatabaseError>;
  }
>()('@froment/api/IntegrationRetries') {}

export const IntegrationRetriesLive = Layer.effect(
  IntegrationRetries,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const integrations = yield* Integrations;
    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Row))(
          sqlite
            .prepare(`${select} order by next_attempt_at desc, operation_id desc limit 100`)
            .all(),
        ).map((row) => ({
          ...row,
          nextAttemptAt:
            row.status === 'waiting' || row.status === 'processing'
              ? DateTime.formatIso(DateTime.makeUnsafe(row.nextAttemptAt))
              : null,
        })),
      catch: databaseFailure,
    });
    const process = Effect.fn('IntegrationRetries.process')(function* (operationId: string) {
      const now = yield* Clock.currentTimeMillis;
      const job = yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const changed = sqlite
                .prepare(`update integration_retries set status = 'processing', attempts = attempts + 1, next_attempt_at = ?, error = null
        where operation_id = ? and status = 'waiting' and attempts < 5 and next_attempt_at <= ?`)
                .run(now + 120000, operationId, now).changes;
              if (changed === 0) return undefined;
              const job = Schema.decodeUnknownSync(Job)(
                sqlite
                  .prepare(`select r.operation_id as operationId, r.attempts, r.status, r.next_attempt_at as nextAttemptAt, r.error, o.request, o.created_by_user_id as userId
        from integration_retries r join integration_operations o on o.id = r.operation_id where r.operation_id = ?`)
                  .get(operationId),
              );
              const allowed = sqlite
                .prepare(`select 1 from users u join user_roles ur on ur.user_id = u.id join role_permissions rp on rp.role_id = ur.role_id
        where u.id = ? and u.kind = 'administrator' and u.disabled_at is null and rp.permission_code = 'integration.manage'`)
                .get(job.userId);
              const scheduled = sqlite
                .prepare('select 1 from email_reminders where operation_id = ?')
                .get(operationId);
              const reminderPermissions =
                scheduled === undefined
                  ? 3
                  : Schema.decodeUnknownSync(Schema.Int)(
                      sqlite
                        .prepare(`select count(distinct rp.permission_code) from user_roles ur join role_permissions rp on rp.role_id = ur.role_id
                where ur.user_id = ? and rp.permission_code in ('email.reminder.manage', 'invoice.read', 'client.read')`)
                        .pluck()
                        .get(job.userId),
                    );
              const reminderCurrent =
                scheduled === undefined ||
                sqlite
                  .prepare(`select 1 from email_reminders m join invoices i on i.id = m.invoice_id join clients c on c.id = i.client_id join users u on u.id = c.id
                 where m.operation_id = ? and i.status = 'issued' and u.disabled_at is null and i.version = m.prepared_version and c.email = m.prepared_recipient
                 and not exists (select 1 from invoice_credit_notes where invoice_id = i.id)
                and coalesce((select sum(amount_cents) from invoice_payments where invoice_id = i.id and cancelled_at is null), 0) = m.prepared_paid_cents`)
                  .get(operationId) !== undefined;
              if (allowed === undefined || reminderPermissions !== 3 || !reminderCurrent) {
                sqlite
                  .prepare(
                    "update integration_retries set status = 'blocked', error = ? where operation_id = ?",
                  )
                  .run(
                    reminderCurrent
                      ? 'integration.retry_permission'
                      : 'integration.request_conflict',
                    operationId,
                  );
                return undefined;
              }
              return job;
            })
            .immediate(),
        catch: databaseFailure,
      });
      if (job === undefined) return;
      const outcome = yield* integrations.submit(job.request, job.userId).pipe(
        Effect.timeout('30 seconds'),
        Effect.map(() => ({ status: 'completed' as const, error: null })),
        Effect.catch((error) =>
          Effect.succeed({
            status:
              error._tag === 'IntegrationConflict' || error._tag === 'IntegrationInvalid'
                ? ('blocked' as const)
                : job.attempts >= 5
                  ? ('exhausted' as const)
                  : ('waiting' as const),
            error:
              error._tag === 'DatabaseError'
                ? ('integration.retry_database' as const)
                : error._tag === 'TimeoutError'
                  ? ('integration.retry_interrupted' as const)
                  : error.code,
          }),
        ),
      );
      const finishedAt = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () => {
          sqlite
            .prepare(
              "update integration_retries set status = ?, error = ?, next_attempt_at = ? where operation_id = ? and status = 'processing' and attempts = ?",
            )
            .run(
              outcome.status,
              outcome.error,
              finishedAt + Math.min(3600000, 60000 * 2 ** job.attempts),
              operationId,
              job.attempts,
            );
        },
        catch: databaseFailure,
      });
    });
    const runPending = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const ids = yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              sqlite
                .prepare(`insert into integration_retries (operation_id, attempts, status, next_attempt_at)
        select id, 0, 'waiting', ? from integration_operations where receipt is null and created_at <= ?
        on conflict(operation_id) do nothing`)
                .run(now, DateTime.formatIso(DateTime.makeUnsafe(now - 60000)));
              sqlite
                .prepare(`update integration_retries set status = 'completed', error = null where status != 'completed'
        and exists (select 1 from integration_operations o where o.id = operation_id and o.receipt is not null)`)
                .run();
              sqlite
                .prepare(`update integration_retries set status = case when attempts >= 5 then 'exhausted' else 'waiting' end, error = 'integration.retry_interrupted'
        where status = 'processing' and next_attempt_at <= ?`)
                .run(now);
              return Schema.decodeUnknownSync(Schema.Array(Schema.String))(
                sqlite
                  .prepare(
                    "select operation_id from integration_retries where status = 'waiting' and next_attempt_at <= ? order by next_attempt_at, operation_id limit 20",
                  )
                  .pluck()
                  .all(now),
              );
            })
            .immediate(),
        catch: databaseFailure,
      });
      yield* Effect.forEach(ids, process, { discard: true });
    });
    return IntegrationRetries.of({ list, runPending });
  }),
);

export const IntegrationRetryWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const retries = yield* IntegrationRetries;
    yield* retries.runPending.pipe(
      Effect.catch((error) => Effect.logError('integration.retry_cycle_failed', error)),
      Effect.repeat(Schedule.spaced('15 seconds')),
      Effect.forkScoped,
    );
  }),
);
