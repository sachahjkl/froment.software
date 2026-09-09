import {
  CheckoutConflict,
  CheckoutOperation,
  CheckoutRequest,
  IntegrationInvalid,
  InvoiceRenderSnapshot,
  type CheckoutErrorCode,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schedule, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import {
  CheckoutTransport,
  CheckoutTransportError,
  matchesCheckout,
} from './checkout-transport.js';

const Row = Schema.Struct({
  ...CheckoutOperation.fields,
  request: Schema.fromJsonString(CheckoutRequest),
  accountKey: Schema.NullOr(Schema.String),
  returnUrl: Schema.String,
  lease: Schema.Int,
  nextAttemptAt: Schema.NullOr(Schema.Int),
});
const select = `select request, revision_id as revisionId, invoice_number as invoiceNumber,
  amount_cents as amountCents, 'EUR' as currency, 'test' as mode, created_by_user_id as createdByUserId,
  created_at as createdAt, updated_at as updatedAt, expires_at as expiresAt, status, attempts, lease,
  next_attempt_at as nextAttemptAt, session_id as sessionId, checkout_url as checkoutUrl, error,
  account_key as accountKey, return_url as returnUrl from checkout_operations`;
const Invoice = Schema.Struct({
  snapshot: Schema.fromJsonString(InvoiceRenderSnapshot),
  balance: Schema.Int,
});
const invoiceSelect = `select r.render_snapshot as snapshot,
  r.total_cents - coalesce((select sum(p.amount_cents) from invoice_payments p where p.invoice_id = i.id and p.cancelled_at is null), 0) as balance
  from invoices i join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
  where i.id = ? and i.version = ? and i.status = 'issued'
  and not exists (select 1 from invoice_credit_notes c where c.invoice_id = i.id)`;
const iso = (time: number) => DateTime.formatIso(DateTime.makeUnsafe(time));
const epoch = (time: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(time));
const publicOperation = ({
  accountKey: _key,
  returnUrl: _url,
  lease: _lease,
  ...row
}: typeof Row.Type): CheckoutOperation => ({
  ...row,
  nextAttemptAt: row.nextAttemptAt === null ? null : iso(row.nextAttemptAt),
});
const databaseError = (cause: unknown) => new DatabaseError({ operation: 'checkout', cause });

const makeCheckouts = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const transport = yield* CheckoutTransport;
  const read = (requestId: string) =>
    Schema.decodeUnknownSync(Row)(sqlite.prepare(`${select} where request_id = ?`).get(requestId));
  const allowed = (actorId: string) =>
    sqlite
      .prepare(`select 1 from users u
    join user_roles ur on ur.user_id = u.id join role_permissions rp on rp.role_id = ur.role_id
    where u.id = ? and u.kind = 'administrator' and u.disabled_at is null
    and rp.permission_code in ('integration.configure', 'invoice.read')
    group by u.id having count(distinct rp.permission_code) = 2`)
      .get(actorId) !== undefined;
  const record = (row: typeof Row.Type, status: string, now: number) =>
    audit.insert({
      action: 'integration.processed',
      actorUserId: row.createdByUserId,
      resourceType: 'integration',
      resourceId: row.request.requestId,
      metadata: {
        provider: 'stripe',
        operation: 'checkout-test',
        status,
        attempts: String(row.attempts),
      },
      occurredAt: now,
    });
  const list = Effect.fn('Checkouts.list')(() =>
    Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Row))(
          sqlite.prepare(`${select} order by created_at desc, request_id desc limit 100`).all(),
        ).map(publicOperation),
      catch: databaseError,
    }),
  );
  const enqueue = Effect.fn('Checkouts.enqueue')(function* (
    request: CheckoutRequest,
    actorId: string,
  ) {
    if (!Schema.is(CheckoutRequest)(request))
      return yield* new IntegrationInvalid({ code: 'integration.invalid_request' });
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (!allowed(actorId)) throw new CheckoutConflict({ code: 'checkout.conflict' });
            if (
              sqlite
                .prepare('select 1 from checkout_operations where request_id = ?')
                .get(request.requestId) !== undefined
            ) {
              const existing = read(request.requestId);
              if (
                existing.createdByUserId !== actorId ||
                !isDeepStrictEqual(existing.request, request)
              )
                throw new CheckoutConflict({ code: 'checkout.conflict' });
              return publicOperation(existing);
            }
            if (
              sqlite
                .prepare(
                  "select 1 from checkout_operations where invoice_id = ? and status in ('queued','creating','retrying','open')",
                )
                .get(request.invoiceId) !== undefined
            )
              throw new CheckoutConflict({ code: 'checkout.active' });
            if (
              Schema.decodeUnknownSync(Schema.Int)(
                sqlite.prepare('select count(*) from checkout_operations').pluck().get(),
              ) >= 100
            )
              throw new CheckoutConflict({ code: 'checkout.limit' });
            const candidate = sqlite
              .prepare(invoiceSelect)
              .get(request.invoiceId, request.expectedVersion);
            if (candidate === undefined)
              throw new CheckoutConflict({ code: 'checkout.invoiceIneligible' });
            const { snapshot, balance } = Schema.decodeUnknownSync(Invoice)(candidate);
            if (
              balance < 50 ||
              balance > 99999999 ||
              snapshot.invoiceNumber === null ||
              snapshot.issuedAt === null ||
              snapshot.version !== request.expectedVersion ||
              snapshot.invoiceId !== request.invoiceId
            )
              throw new CheckoutConflict({ code: 'checkout.invoiceIneligible' });
            const expiresAt = Math.floor(now / 1000) * 1000 + 23 * 3600000;
            const returnUrl = `${transport.publicOrigin}/backoffice/configuration/services/stripe?request=${request.requestId}`;
            sqlite
              .prepare(`insert into checkout_operations (request_id, request, invoice_id, revision_id, invoice_number, amount_cents,
        created_by_user_id, created_at, updated_at, expires_at, return_url, account_key, status, next_attempt_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`)
              .run(
                request.requestId,
                JSON.stringify(request),
                request.invoiceId,
                snapshot.revisionId,
                snapshot.invoiceNumber,
                balance,
                actorId,
                iso(now),
                iso(now),
                iso(expiresAt),
                returnUrl,
                transport.accountKey,
                now,
              );
            audit.insert({
              action: 'integration.requested',
              actorUserId: actorId,
              resourceType: 'integration',
              resourceId: request.requestId,
              metadata: {
                provider: 'stripe',
                operation: 'checkout-test',
                invoiceId: request.invoiceId,
              },
              occurredAt: now,
            });
            return publicOperation(read(request.requestId));
          })
          .immediate(),
      catch: (cause) => (cause instanceof CheckoutConflict ? cause : databaseError(cause)),
    });
  });
  const process = Effect.fn('Checkouts.process')(function* (requestId: string) {
    const now = yield* Clock.currentTimeMillis;
    const job = yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const row = read(requestId);
            if (row.nextAttemptAt === null || row.nextAttemptAt > now) return undefined;
            const reading = row.status === 'open';
            if (!reading && !['queued', 'creating', 'retrying'].includes(row.status))
              return undefined;
            let error: typeof CheckoutErrorCode.Type | null = !allowed(row.createdByUserId)
              ? 'checkout.permissionRevoked'
              : !transport.connection.credentialsPresent
                ? 'checkout.credentialsMissing'
                : !transport.connection.testKey
                  ? 'checkout.testKeyRequired'
                  : transport.accountKey !== row.accountKey
                    ? 'checkout.credentialsChanged'
                    : null;
            if (error === null && !reading) {
              if (now >= epoch(row.expiresAt) - 3600000 || row.attempts >= 5)
                error = 'checkout.deadline';
              else {
                const candidate = sqlite
                  .prepare(invoiceSelect)
                  .get(row.request.invoiceId, row.request.expectedVersion);
                if (candidate === undefined) error = 'checkout.invoiceChanged';
                else {
                  const current = Schema.decodeUnknownSync(Invoice)(candidate);
                  if (
                    current.balance !== row.amountCents ||
                    current.snapshot.revisionId !== row.revisionId
                  )
                    error = 'checkout.invoiceChanged';
                }
              }
            }
            if (reading && now >= epoch(row.expiresAt) + 3 * 86400000)
              error = 'checkout.statusUnavailable';
            if (error !== null) {
              sqlite
                .prepare(
                  'update checkout_operations set lease = lease + 1, status = ?, error = ?, updated_at = ?, next_attempt_at = null where request_id = ?',
                )
                .run(reading ? 'open' : 'blocked', error, iso(now), requestId);
              record(row, error, now);
              return undefined;
            }
            sqlite
              .prepare(
                'update checkout_operations set lease = lease + 1, status = ?, attempts = attempts + ?, updated_at = ?, next_attempt_at = ? where request_id = ?',
              )
              .run(
                reading ? 'open' : 'creating',
                reading ? 0 : 1,
                iso(now),
                now + 120000,
                requestId,
              );
            return read(requestId);
          })
          .immediate(),
      catch: databaseError,
    });
    if (job === undefined) return;
    const reading = job.status === 'open';
    const outcome = yield* (
      reading
        ? job.sessionId === null
          ? Effect.fail(
              new CheckoutTransportError({ code: 'checkout.responseMismatch', retryable: false }),
            )
          : transport.retrieve(job.sessionId)
        : transport.create({
            requestId,
            revisionId: job.revisionId,
            invoiceNumber: job.invoiceNumber,
            amountCents: job.amountCents,
            expiresAt: epoch(job.expiresAt),
            returnUrl: job.returnUrl,
          })
    ).pipe(Effect.result);
    const finished = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            let status: CheckoutOperation['status'];
            let error: typeof CheckoutErrorCode.Type | null;
            let sessionId = job.sessionId;
            let checkoutUrl = job.checkoutUrl;
            if (
              outcome._tag === 'Success' &&
              matchesCheckout(publicOperation(job), outcome.success)
            ) {
              const session = outcome.success;
              status = session.status;
              sessionId = session.id;
              checkoutUrl = session.status === 'open' ? session.url : null;
              error = null;
            } else {
              const failure =
                outcome._tag === 'Failure'
                  ? outcome.failure
                  : { code: 'checkout.responseMismatch' as const, retryable: false };
              status = reading
                ? 'open'
                : failure.retryable && job.attempts < 5
                  ? 'retrying'
                  : 'failed';
              error = reading ? 'checkout.statusUnavailable' : failure.code;
            }
            const next =
              status === 'open'
                ? finished + (error === null ? 30000 : 300000)
                : status === 'retrying'
                  ? finished + 60000 * 2 ** job.attempts
                  : null;
            const changed = sqlite
              .prepare(
                'update checkout_operations set status = ?, error = ?, session_id = ?, checkout_url = ?, updated_at = ?, next_attempt_at = ? where request_id = ? and lease = ? and status = ?',
              )
              .run(
                status,
                error,
                sessionId,
                checkoutUrl,
                iso(finished),
                next,
                requestId,
                job.lease,
                job.status,
              ).changes;
            if (changed > 0 && (status !== job.status || error !== job.error))
              record(job, error ?? status, finished);
          })
          .immediate(),
      catch: databaseError,
    });
  });
  const runPending = Effect.fn('Checkouts.runPending')(function* () {
    const now = yield* Clock.currentTimeMillis;
    const ids = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(Schema.String))(
          sqlite
            .prepare(
              'select request_id from checkout_operations where next_attempt_at <= ? order by next_attempt_at, request_id limit 10',
            )
            .pluck()
            .all(now),
        ),
      catch: databaseError,
    });
    yield* Effect.forEach(ids, process, { discard: true });
  });
  const receiveEvent = Effect.fn('Checkouts.receiveEvent')(function* (event: {
    readonly id: string;
    readonly type: string;
    readonly sessionId: string;
  }) {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const row = Schema.decodeUnknownSync(Schema.UndefinedOr(Row))(
              sqlite.prepare(`${select} where session_id = ?`).get(event.sessionId),
            );
            if (row === undefined || row.accountKey !== transport.accountKey) return;
            const inserted = sqlite
              .prepare(
                'insert into checkout_events (event_id, request_id, event_type, received_at) values (?, ?, ?, ?) on conflict(event_id) do nothing',
              )
              .run(event.id, row.request.requestId, event.type, now).changes;
            if (inserted > 0 && row.status === 'open') {
              sqlite
                .prepare(
                  "update checkout_operations set next_attempt_at = ?, lease = lease + 1 where request_id = ? and status = 'open'",
                )
                .run(now, row.request.requestId);
              record(row, 'webhook-received', now);
            }
          })
          .immediate(),
      catch: databaseError,
    });
  });
  return { connection: transport.connection, enqueue, list, runPending, receiveEvent };
});
export class Checkouts extends Context.Service<Checkouts, Effect.Success<typeof makeCheckouts>>()(
  '@froment/api/Checkouts',
) {}
export const CheckoutsLive = Layer.effect(Checkouts, makeCheckouts);
export const CheckoutWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const checkouts = yield* Checkouts;
    yield* checkouts.runPending().pipe(
      Effect.catch(() => Effect.logError('checkout.worker_failed')),
      Effect.repeat(Schedule.spaced('3 seconds')),
      Effect.forkScoped,
    );
  }),
);
