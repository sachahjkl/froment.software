import {
  AccountEmail,
  CalendarDate,
  EmailSubmission,
  Reminder,
  ReminderCreate,
  ReminderConflict,
  ReminderNotFound,
  ReminderRejected,
  ReminderRejectionReason,
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
const RejectionRow = Schema.Struct({
  request: Schema.fromJsonString(ReminderCreate),
  reason: ReminderRejectionReason,
  createdByUserId: Schema.String,
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
type Failure = DatabaseError | ReminderConflict | ReminderNotFound | ReminderRejected;
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
       where i.id = ? and i.status = 'issued' and u.disabled_at is null
       and r.total_cents > coalesce((select sum(p.amount_cents) from invoice_payments p where p.invoice_id = i.id and p.cancelled_at is null), 0)
         + coalesce((select sum(l.total_cents) from invoice_credit_note_lines l
           join invoice_credit_notes n on n.id = l.credit_note_id
           join invoice_credit_note_revisions cr on cr.id = l.credit_note_revision_id
           where l.invoice_id = i.id and n.status = 'issued' and cr.version = n.version), 0)`)
        .get(id);
      if (row === undefined) return undefined;
      const value = Schema.decodeUnknownSync(Invoice)(row);
      return value.totalCents > value.paidCents ? value : undefined;
    };
    const rejectionReason = (
      request: typeof ReminderCreate.Type,
      now: number,
    ): typeof ReminderRejectionReason.Type | null => {
      const current = invoice(request.invoiceId);
      if (current === undefined) return 'invoice-ineligible';
      if (current.version !== request.expectedVersion) return 'invoice-changed';
      if (!Schema.is(AccountEmail)(current.recipient)) return 'recipient-invalid';
      if (provider.mode !== request.expectedMode) return 'mode-changed';
      const sendAt = DateTime.toEpochMillis(DateTime.makeUnsafe(request.sendAt));
      if (sendAt <= now || sendAt > now + 366 * 86400000) return 'date-invalid';
      if (
        sqlite
          .prepare("select 1 from email_reminders where invoice_id = ? and status = 'scheduled'")
          .get(request.invoiceId) !== undefined
      )
        return 'already-scheduled';
      const count = Schema.decodeUnknownSync(Schema.Int)(
        sqlite
          .prepare("select count(*) from email_reminders where status = 'scheduled'")
          .pluck()
          .get(),
      );
      return count >= 100 ? 'limit' : null;
    };
    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Row))(
          sqlite
            .prepare(`${select} order by (status = 'scheduled') desc,
              case when status = 'scheduled' then send_at end asc,
              case when status != 'scheduled' then send_at end desc, id desc limit 100`)
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
      const result = yield* Effect.try({
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
              const rejected = sqlite
                .prepare(
                  'select request, reason, created_by_user_id as createdByUserId from email_reminder_rejections where request_id = ?',
                )
                .get(id);
              if (rejected !== undefined) {
                const saved = Schema.decodeUnknownSync(RejectionRow)(rejected);
                if (saved.createdByUserId !== userId || !isDeepStrictEqual(saved.request, request))
                  throw new ReminderConflict({ code: 'reminder.conflict' });
                return new ReminderRejected({
                  code: 'reminder.rejected',
                  requestId: id,
                  request: saved.request,
                  reason: saved.reason,
                });
              }
              if (
                sqlite
                  .prepare('select 1 from integration_operations where request_id = ?')
                  .get(id) !== undefined ||
                sqlite.prepare('select 1 from email_drafts where id = ?').get(id) !== undefined
              )
                throw new ReminderConflict({ code: 'reminder.conflict' });
              const reason = rejectionReason(request, now);
              if (reason !== null) {
                sqlite
                  .prepare(`insert into email_reminder_rejections (request_id, request, reason, created_by_user_id, created_at)
                  values (?, ?, ?, ?, ?)`)
                  .run(
                    id,
                    JSON.stringify(request),
                    reason,
                    userId,
                    DateTime.formatIso(DateTime.makeUnsafe(now)),
                  );
                audit.insert({
                  action: 'email.reminder-rejected',
                  actorUserId: userId,
                  resourceType: 'integration',
                  resourceId: id,
                  occurredAt: now,
                  metadata: { reason },
                });
                return new ReminderRejected({
                  code: 'reminder.rejected',
                  requestId: id,
                  request,
                  reason,
                });
              }
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
      // Commit the refusal before returning its API error.
      if (result instanceof ReminderRejected) return yield* result;
      return result;
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
