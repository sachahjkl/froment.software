import {
  AccountEmail,
  CalendarDate,
  EmailSubmission,
  Reminder,
  ReminderCreate,
  ReminderConflict,
  ReminderNotFound,
  InvoiceSummary,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schedule, Schema } from 'effect';
import { formatMoney, formatTranslation } from '@froment/l10n';
import { isDeepStrictEqual } from 'node:util';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { EmailProvider } from './providers.js';
import { recordOperation } from './record-operation.js';

const Row = Schema.Struct({
  invoiceReference: Schema.NonEmptyString,
  id: Schema.String,
  request: Schema.fromJsonString(ReminderCreate),
  status: Reminder.fields.status,
  reason: Reminder.fields.reason,
  operationId: Reminder.fields.operationId,
  createdByUserId: Schema.String,
  createdAt: Schema.String,
});
const select =
  'select id, request, status, reason, operation_id as operationId, created_by_user_id as createdByUserId, created_at as createdAt, (select invoice_number from invoices where id = email_reminders.invoice_id) as invoiceReference from email_reminders';
const decode = (row: typeof Row.Type) =>
  Schema.decodeUnknownSync(Reminder)({ ...row.request, ...row });
const Invoice = Schema.Struct({
  version: InvoiceSummary.fields.version,
  reference: Schema.String,
  dueDate: CalendarDate,
  totalCents: InvoiceSummary.fields.totalCents,
  paidCents: InvoiceSummary.fields.recordedPaidCents,
  recipient: Schema.String,
});
type Failure = DatabaseError | ReminderConflict | ReminderNotFound;
const failure = (cause: unknown) =>
  cause instanceof ReminderConflict || cause instanceof ReminderNotFound
    ? cause
    : new DatabaseError({ operation: 'email.reminder', cause });

export class Reminders extends Context.Service<
  Reminders,
  {
    readonly list: Effect.Effect<ReadonlyArray<typeof Reminder.Type>, Failure>;
    readonly create: (
      id: string,
      request: typeof ReminderCreate.Type,
      userId: string,
    ) => Effect.Effect<typeof Reminder.Type, Failure>;
    readonly cancel: (id: string, userId: string) => Effect.Effect<typeof Reminder.Type, Failure>;
    readonly runPending: Effect.Effect<void, Failure>;
  }
>()('@froment/api/Reminders') {}

export const RemindersLive = Layer.effect(
  Reminders,
  Effect.gen(function* () {
    const database = yield* Database;
    const { sqlite } = database;
    const audit = yield* Audit;
    const provider = yield* EmailProvider;
    const read = (id: string) => {
      const row = sqlite.prepare(`${select} where id = ?`).get(id);
      if (row === undefined) throw new ReminderNotFound({ code: 'reminder.not_found' });
      return decode(Schema.decodeUnknownSync(Row)(row));
    };
    const invoice = (id: string) => {
      const row = sqlite
        .prepare(`select i.version, i.invoice_number as reference, r.due_date as dueDate, r.total_cents as totalCents, c.email as recipient,
      coalesce((select sum(amount_cents) from invoice_payments where invoice_id = i.id and cancelled_at is null), 0) as paidCents
      from invoices i join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
      join clients c on c.id = i.client_id join users u on u.id = c.id
      where i.id = ? and i.status = 'issued' and u.disabled_at is null`)
        .get(id);
      if (row === undefined) return undefined;
      const value = Schema.decodeUnknownSync(Invoice)(row);
      return value.totalCents > value.paidCents ? value : undefined;
    };
    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Row))(
          sqlite
            .prepare(`${select} order by (status = 'scheduled') desc, send_at, id limit 100`)
            .all(),
        ).map(decode),
      catch: failure,
    });
    const create = Effect.fn('Reminders.create')(function* (
      id: string,
      request: typeof ReminderCreate.Type,
      userId: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const existing = sqlite.prepare(`${select} where id = ?`).get(id);
              if (existing !== undefined) {
                const saved = Schema.decodeUnknownSync(Row)(existing);
                if (saved.createdByUserId === userId && isDeepStrictEqual(saved.request, request))
                  return decode(saved);
                throw new ReminderConflict({ code: 'reminder.conflict' });
              }
              const current = invoice(request.invoiceId);
              const sendAt = DateTime.toEpochMillis(DateTime.makeUnsafe(request.sendAt));
              if (
                current === undefined ||
                current.version !== request.expectedVersion ||
                !Schema.is(AccountEmail)(current.recipient) ||
                provider.mode !== request.expectedMode ||
                sendAt <= now ||
                sendAt > now + 366 * 86400000 ||
                sqlite
                  .prepare(
                    "select 1 from email_reminders where invoice_id = ? and status = 'scheduled'",
                  )
                  .get(request.invoiceId) !== undefined ||
                sqlite
                  .prepare('select 1 from integration_operations where request_id = ?')
                  .get(id) !== undefined ||
                sqlite.prepare('select 1 from email_drafts where id = ?').get(id) !== undefined ||
                Schema.decodeUnknownSync(Schema.Int)(
                  sqlite
                    .prepare("select count(*) from email_reminders where status = 'scheduled'")
                    .pluck()
                    .get(),
                ) >= 100
              )
                throw new ReminderConflict({ code: 'reminder.conflict' });
              sqlite
                .prepare(
                  'insert into email_reminders (id, invoice_id, request, send_at, status, created_by_user_id, created_at) values (?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  id,
                  request.invoiceId,
                  JSON.stringify(request),
                  request.sendAt,
                  'scheduled',
                  userId,
                  DateTime.formatIso(DateTime.makeUnsafe(now)),
                );
              audit.insert({
                action: 'email.reminder-scheduled',
                actorUserId: userId,
                resourceType: 'integration',
                resourceId: id,
                occurredAt: now,
              });
              return read(id);
            })
            .immediate(),
        catch: failure,
      });
    });
    const cancel = Effect.fn('Reminders.cancel')(function* (id: string, userId: string) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const current = read(id);
              if (current.status === 'cancelled') return current;
              if (current.status !== 'scheduled')
                throw new ReminderConflict({ code: 'reminder.conflict' });
              sqlite
                .prepare("update email_reminders set status = 'cancelled' where id = ?")
                .run(id);
              audit.insert({
                action: 'email.reminder-cancelled',
                actorUserId: userId,
                resourceType: 'integration',
                resourceId: id,
                occurredAt: now,
              });
              return read(id);
            })
            .immediate(),
        catch: failure,
      });
    });
    const runPending = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const due = Schema.decodeUnknownSync(Schema.Array(Row))(
                sqlite
                  .prepare(
                    `${select} where status = 'scheduled' and send_at <= ? order by send_at, id limit 20`,
                  )
                  .all(DateTime.formatIso(DateTime.makeUnsafe(now))),
              );
              for (const row of due) {
                const job = decode(row);
                const permissionCount = Schema.decodeUnknownSync(Schema.Int)(
                  sqlite
                    .prepare(`select count(distinct rp.permission_code) from users u join user_roles ur on ur.user_id = u.id join role_permissions rp on rp.role_id = ur.role_id
          where u.id = ? and u.disabled_at is null and u.kind = 'administrator' and rp.permission_code in ('email.reminder.manage', 'invoice.read', 'client.read', 'integration.manage')`)
                    .pluck()
                    .get(job.createdByUserId),
                );
                const current = invoice(job.invoiceId);
                const reason =
                  permissionCount !== 4
                    ? 'permission-revoked'
                    : provider.mode !== job.expectedMode
                      ? 'mode-changed'
                      : current === undefined
                        ? 'invoice-ineligible'
                        : !Schema.is(AccountEmail)(current.recipient)
                          ? 'recipient-invalid'
                          : null;
                if (reason !== null || current === undefined) {
                  sqlite
                    .prepare(
                      "update email_reminders set status = 'skipped', reason = ? where id = ?",
                    )
                    .run(reason, job.id);
                } else {
                  const dueDate = new Intl.DateTimeFormat(job.language, {
                    dateStyle: 'long',
                    timeZone: 'UTC',
                  }).format(new Date(`${current.dueDate}T00:00:00Z`));
                  const request = Schema.decodeUnknownSync(EmailSubmission)({
                    kind: 'email',
                    requestId: job.id,
                    expectedMode: job.expectedMode,
                    recipient: current.recipient,
                    reference: current.reference,
                    subject: formatTranslation(job.language, 'emails.reminderSubject', {
                      reference: current.reference,
                    }),
                    body: formatTranslation(job.language, 'emails.reminderBody', {
                      reference: current.reference,
                      amount: formatMoney(
                        current.totalCents - current.paidCents,
                        job.language,
                        'EUR',
                      ),
                      dueDate,
                    }),
                  });
                  const operation = recordOperation(
                    database,
                    audit,
                    request,
                    job.createdByUserId,
                    now,
                  );
                  sqlite
                    .prepare(
                      "insert into integration_retries (operation_id, attempts, status, next_attempt_at) values (?, 0, 'waiting', ?)",
                    )
                    .run(operation.id, now);
                  sqlite
                    .prepare(
                      "update email_reminders set status = 'queued', operation_id = ?, prepared_version = ?, prepared_paid_cents = ?, prepared_recipient = ? where id = ?",
                    )
                    .run(
                      operation.id,
                      current.version,
                      current.paidCents,
                      current.recipient,
                      job.id,
                    );
                }
                audit.insert({
                  action: 'email.reminder-processed',
                  actorUserId: job.createdByUserId,
                  resourceType: 'integration',
                  resourceId: job.id,
                  occurredAt: now,
                  metadata: {
                    status: reason === null ? 'queued' : 'skipped',
                    reason: reason ?? '',
                  },
                });
              }
            })
            .immediate(),
        catch: failure,
      });
    });
    return Reminders.of({ list, create, cancel, runPending });
  }),
);

export const ReminderWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const reminders = yield* Reminders;
    yield* reminders.runPending.pipe(
      Effect.catch((error) => Effect.logError('email.reminder_cycle_failed', error)),
      Effect.repeat(Schedule.spaced('15 seconds')),
      Effect.forkScoped,
    );
  }),
);
