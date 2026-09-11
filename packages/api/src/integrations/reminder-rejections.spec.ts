import {
  ReminderCreate,
  ReminderRejected,
  ReminderFailure,
  isReminderRejectionFor,
} from '@froment/contracts';
import { Effect, Layer, Schema } from 'effect';
import { TestClock } from 'effect/testing';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { expect, it } from 'vitest';
import { Database } from '../database/database.js';
import { EmailDrafts, EmailDraftsLive } from './email-drafts.js';
import {
  integrationDatabaseLayer,
  integrationTestTime,
  seedIntegrationInvoice,
} from './invoice.spec-helper.js';
import { SimulatedProviders } from './providers.js';
import { Reminders, RemindersLive } from './reminders.js';
import { Integrations, IntegrationsLive } from './service.js';

const layer = () =>
  Layer.mergeAll(RemindersLive, EmailDraftsLive, IntegrationsLive).pipe(
    Layer.provide(SimulatedProviders),
    Layer.provideMerge(integrationDatabaseLayer()),
  );
const requestFor = (invoiceId: string): typeof ReminderCreate.Type => ({
  invoiceId,
  expectedVersion: 1,
  expectedMode: 'simulation',
  language: 'fr',
  sendAt: new Date(integrationTestTime + 60000).toISOString(),
});
const email = {
  recipient: 'client@example.test',
  reference: 'TEST',
  subject: 'Reminder',
  body: 'Test reminder',
};

it.each([
  'date-invalid',
  'invoice-changed',
  'mode-changed',
  'recipient-invalid',
  'invoice-ineligible',
  'already-scheduled',
] as const)('persists a precise %s refusal before creation', async (reason) => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const invoice = yield* seedIntegrationInvoice();
      const reminders = yield* Reminders;
      const { sqlite } = yield* Database;
      const request = requestFor(invoice.invoiceId);
      const id = randomUUID();
      const rejectedRequest = {
        ...request,
        expectedVersion: reason === 'invoice-changed' ? 2 : 1,
        expectedMode: reason === 'mode-changed' ? ('live' as const) : ('simulation' as const),
      };
      if (reason === 'date-invalid') yield* TestClock.adjust('1 minute');
      if (reason === 'recipient-invalid')
        sqlite.prepare("update clients set email = '' where id = ?").run(invoice.clientId);
      if (reason === 'invoice-ineligible') {
        sqlite
          .prepare(`insert into invoice_payments (id, invoice_id, request_id, expected_version, amount_cents,
          paid_on, method, reference, recorded_at, recorded_by_user_id)
          values (?, ?, ?, 1, 12000, '2026-09-09', 'transfer', 'BALANCE', ?, ?)`)
          .run(
            ulid(),
            invoice.invoiceId,
            randomUUID(),
            new Date(integrationTestTime).toISOString(),
            invoice.actorId,
          );
        expect(
          sqlite
            .prepare('select version from invoices where id = ?')
            .pluck()
            .get(invoice.invoiceId),
        ).toBe(1);
      }
      if (reason === 'already-scheduled')
        yield* reminders.create(randomUUID(), request, invoice.actorId);
      const error = yield* reminders.create(id, rejectedRequest, invoice.actorId).pipe(Effect.flip);
      expect(error).toBeInstanceOf(ReminderRejected);
      expect(error).toMatchObject({
        code: 'reminder.rejected',
        requestId: id,
        request: rejectedRequest,
        reason,
      });
      if (!(error instanceof ReminderRejected)) throw new Error('Expected a precise refusal');
      const wire = yield* Schema.encodeEffect(ReminderFailure)(error);
      const decoded = yield* Schema.decodeUnknownEffect(ReminderFailure)(
        JSON.parse(JSON.stringify(wire)),
      );
      if (decoded._tag !== 'ReminderRejected') throw new Error('Expected a precise refusal');
      expect(isReminderRejectionFor(decoded, id, rejectedRequest)).toBe(true);
      expect(
        sqlite.prepare('select count(*) from email_reminders where id = ?').pluck().get(id),
      ).toBe(0);
      expect(sqlite.prepare('select count(*) from integration_operations').pluck().get()).toBe(0);
      expect(
        sqlite
          .prepare('select reason from email_reminder_rejections where request_id = ?')
          .pluck()
          .get(id),
      ).toBe(reason);
      expect(
        yield* reminders.create(id, rejectedRequest, invoice.actorId).pipe(Effect.flip),
      ).toEqual(error);
      expect(
        sqlite
          .prepare(
            "select count(*) from audit_events where action = 'email.reminder-rejected' and resource_id = ?",
          )
          .pluck()
          .get(id),
      ).toBe(1);
    }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
  );
});

it('keeps a lost refusal terminal after conditions change and permits a corrected request with a new identifier', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const invoice = yield* seedIntegrationInvoice();
      const reminders = yield* Reminders;
      const { sqlite } = yield* Database;
      const request = requestFor(invoice.invoiceId);
      const existingId = randomUUID();
      const rejectedId = randomUUID();
      yield* reminders.create(existingId, request, invoice.actorId);
      const rejected = yield* reminders
        .create(rejectedId, request, invoice.actorId)
        .pipe(Effect.flip);
      expect(rejected).toMatchObject({ reason: 'already-scheduled' });
      yield* reminders.cancel(existingId, invoice.actorId);
      const restarted = yield* Reminders.pipe(
        Effect.provide(RemindersLive.pipe(Layer.provide(SimulatedProviders))),
      );
      expect(
        yield* restarted.create(rejectedId, request, invoice.actorId).pipe(Effect.flip),
      ).toEqual(rejected);
      expect(yield* restarted.create(randomUUID(), request, invoice.actorId)).toMatchObject({
        status: 'scheduled',
      });
      yield* TestClock.adjust('1 minute');
      yield* restarted.runPending;
      expect(sqlite.prepare('select count(*) from integration_operations').pluck().get()).toBe(1);
      expect(
        sqlite
          .prepare('select count(*) from integration_operations where request_id = ?')
          .pluck()
          .get(rejectedId),
      ).toBe(0);
      expect(
        yield* restarted.create(rejectedId, request, invoice.actorId).pipe(Effect.flip),
      ).toEqual(rejected);
    }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
  );
});

it('never converts an existing or changed request into a definitive refusal', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const invoice = yield* seedIntegrationInvoice();
      const other = yield* seedIntegrationInvoice();
      const reminders = yield* Reminders;
      const request = requestFor(invoice.invoiceId);
      const acceptedId = randomUUID();
      const accepted = yield* reminders.create(acceptedId, request, invoice.actorId);
      yield* TestClock.adjust('2 minutes');
      expect(yield* reminders.create(acceptedId, request, invoice.actorId)).toEqual(accepted);
      expect(
        yield* reminders
          .create(acceptedId, { ...request, language: 'en' }, invoice.actorId)
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: 'ReminderConflict' });
      const rejectedId = randomUUID();
      const rejected = yield* reminders
        .create(rejectedId, request, invoice.actorId)
        .pipe(Effect.flip);
      if (rejected._tag !== 'ReminderRejected') throw new Error('Expected a precise refusal');
      for (const changed of [
        { ...request, language: 'en' as const },
        { ...request, expectedVersion: 2 },
        { ...request, expectedMode: 'live' as const },
        { ...request, sendAt: new Date(integrationTestTime + 180000).toISOString() },
        { ...request, invoiceId: other.invoiceId },
      ]) {
        expect(isReminderRejectionFor(rejected, rejectedId, changed)).toBe(false);
        expect(
          yield* reminders.create(rejectedId, changed, invoice.actorId).pipe(Effect.flip),
        ).toMatchObject({ _tag: 'ReminderConflict' });
      }
      expect(isReminderRejectionFor(rejected, randomUUID(), request)).toBe(false);
      expect(
        yield* reminders.create(rejectedId, request, other.actorId).pipe(Effect.flip),
      ).toMatchObject({ _tag: 'ReminderConflict' });
      expect(
        yield* reminders.create(acceptedId, request, other.actorId).pipe(Effect.flip),
      ).toMatchObject({ _tag: 'ReminderConflict' });
    }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
  );
});

it('reserves rejected identifiers against draft and submission collisions in both directions', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const invoice = yield* seedIntegrationInvoice();
      const reminders = yield* Reminders;
      const drafts = yield* EmailDrafts;
      const integrations = yield* Integrations;
      const { sqlite } = yield* Database;
      const request = {
        ...requestFor(invoice.invoiceId),
        sendAt: new Date(integrationTestTime).toISOString(),
      };
      const rejectedId = randomUUID();
      yield* reminders.create(rejectedId, request, invoice.actorId).pipe(Effect.flip);
      const draft = { ...email, expectedVersion: 0, reminder: false };
      const submission = {
        ...email,
        requestId: rejectedId,
        kind: 'email' as const,
        expectedMode: 'simulation' as const,
      };
      expect(
        yield* drafts.save(invoice.actorId, rejectedId, draft).pipe(Effect.flip),
      ).toMatchObject({ _tag: 'EmailDraftConflict' });
      expect(
        yield* integrations.submit(submission, invoice.actorId).pipe(Effect.flip),
      ).toMatchObject({ _tag: 'IntegrationConflict' });
      const draftId = randomUUID();
      const submittedId = randomUUID();
      yield* drafts.save(invoice.actorId, draftId, draft);
      yield* integrations.submit({ ...submission, requestId: submittedId }, invoice.actorId);
      for (const id of [draftId, submittedId]) {
        expect(
          yield* reminders.create(id, request, invoice.actorId).pipe(Effect.flip),
        ).toMatchObject({ _tag: 'ReminderConflict' });
        expect(
          sqlite
            .prepare('select count(*) from email_reminder_rejections where request_id = ?')
            .pluck()
            .get(id),
        ).toBe(0);
      }
    }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
  );
});

it('records the active schedule limit as a definitive refusal without creating a reminder', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const reminders = yield* Reminders;
      for (let count = 0; count < 100; count++) {
        const invoice = yield* seedIntegrationInvoice();
        yield* reminders.create(randomUUID(), requestFor(invoice.invoiceId), invoice.actorId);
      }
      const invoice = yield* seedIntegrationInvoice();
      expect(
        yield* reminders
          .create(randomUUID(), requestFor(invoice.invoiceId), invoice.actorId)
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: 'ReminderRejected', reason: 'limit' });
      expect(yield* reminders.list).toHaveLength(100);
    }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
  );
});
