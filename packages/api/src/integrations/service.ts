import {
  IntegrationConflict,
  IntegrationInvalid,
  IntegrationOperation,
  IntegrationSubmission,
  EmailDraftContent,
  ProviderReceipt,
  type IntegrationSubmissionValue,
  type ProviderReceiptValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { isDeepStrictEqual } from 'node:util';
import { recordOperation } from './record-operation.js';
import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import {
  BankingProvider,
  ElectronicInvoiceProvider,
  EmailProvider,
  PaymentProvider,
  SignatureProvider,
} from './providers.js';

const Row = Schema.Struct({
  ...IntegrationOperation.fields,
  request: Schema.fromJsonString(IntegrationSubmission),
  receipt: Schema.NullOr(Schema.fromJsonString(ProviderReceipt)),
});
const select =
  'select id, request, receipt, created_at as createdAt, created_by_user_id as createdByUserId from integration_operations';

const makeIntegrations = Effect.gen(function* () {
  const database = yield* Database;
  const audit = yield* Audit;
  const email = yield* EmailProvider;
  const signature = yield* SignatureProvider;
  const payment = yield* PaymentProvider;
  const banking = yield* BankingProvider;
  const electronicInvoice = yield* ElectronicInvoiceProvider;
  const providers = { email, signature, payment, banking, 'electronic-invoice': electronicInvoice };
  const status = Effect.succeed([
    { kind: 'email' as const, mode: email.mode },
    { kind: 'signature' as const, mode: signature.mode },
    { kind: 'payment' as const, mode: payment.mode },
    { kind: 'banking' as const, mode: banking.mode },
    { kind: 'electronic-invoice' as const, mode: electronicInvoice.mode },
  ]);
  const list = Effect.fn('Integrations.list')(
    (kind: IntegrationSubmissionValue['kind'] | undefined) =>
      Effect.try({
        try: () =>
          Schema.decodeUnknownSync(Schema.Array(Row))(
            database.sqlite
              .prepare(
                `${select} where (? is null or json_extract(request, '$.kind') = ?) order by created_at desc, id desc limit 100`,
              )
              .all(kind ?? null, kind ?? null),
          ),
        catch: (cause) => new DatabaseError({ operation: 'list.integration.operations', cause }),
      }),
  );
  const submit = Effect.fn('Integrations.submit')(function* (
    request: IntegrationSubmissionValue,
    actorUserId: string,
  ) {
    if (
      !Schema.is(IntegrationSubmission)(request) ||
      (request.kind === 'banking' && request.from > request.to)
    )
      return yield* new IntegrationInvalid({ code: 'integration.invalid_request' });
    const now = yield* Clock.currentTimeMillis;
    const operation = yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            const existing = database.sqlite
              .prepare(`${select} where request_id = ?`)
              .get(request.requestId);
            if (existing !== undefined) {
              const decoded = Schema.decodeUnknownSync(Row)(existing);
              if (!isDeepStrictEqual(decoded.request, request))
                throw new IntegrationConflict({ code: 'integration.request_conflict' });
              return decoded;
            }
            if (providers[request.kind].mode !== request.expectedMode) {
              throw new IntegrationConflict({ code: 'integration.request_conflict' });
            }
            if (
              database.sqlite
                .prepare('select 1 from email_reminders where id = ?')
                .get(request.requestId) !== undefined
            )
              throw new IntegrationConflict({ code: 'integration.request_conflict' });
            const draft = database.sqlite
              .prepare('select user_id as userId, content, archived from email_drafts where id = ?')
              .get(request.requestId);
            if (draft !== undefined) {
              const saved = Schema.decodeUnknownSync(
                Schema.Struct({
                  userId: Schema.String,
                  content: Schema.fromJsonString(EmailDraftContent),
                  archived: Schema.Int,
                }),
              )(draft);
              if (
                request.kind !== 'email' ||
                saved.userId !== actorUserId ||
                saved.archived !== 0 ||
                request.recipient !== saved.content.recipient ||
                request.subject !== saved.content.subject ||
                request.reference !== saved.content.reference ||
                request.body !== saved.content.body
              ) {
                throw new IntegrationConflict({ code: 'integration.request_conflict' });
              }
            }
            const operation = recordOperation(database, audit, request, actorUserId, now);
            if (draft !== undefined)
              database.sqlite
                .prepare('update email_drafts set archived = 1 where id = ?')
                .run(request.requestId);
            return operation;
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof IntegrationConflict
          ? cause
          : new DatabaseError({ operation: 'create.integration.operation', cause }),
    });
    if (operation.receipt !== null) return operation;
    if (providers[request.kind].mode !== request.expectedMode)
      return yield* new IntegrationConflict({ code: 'integration.request_conflict' });
    let receipt: ProviderReceiptValue;
    switch (request.kind) {
      case 'email':
        receipt = yield* email.submit(request);
        break;
      case 'signature':
        receipt = yield* signature.submit(request);
        break;
      case 'payment':
        receipt = yield* payment.submit(request);
        break;
      case 'banking':
        receipt = yield* banking.submit(request);
        break;
      case 'electronic-invoice':
        receipt = yield* electronicInvoice.submit(request);
        break;
    }
    return yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            const checked = Schema.decodeUnknownSync(ProviderReceipt)(receipt);
            if (checked.mode !== request.expectedMode)
              throw new Error('integration.provider_mode_mismatch');
            const changed = database.sqlite
              .prepare(
                'update integration_operations set receipt = ? where id = ? and receipt is null',
              )
              .run(JSON.stringify(checked), operation.id).changes;
            if (changed > 0)
              audit.insert({
                action: 'integration.processed',
                actorUserId,
                resourceType: 'integration',
                resourceId: operation.id,
                metadata: { mode: checked.mode, status: checked.status },
                occurredAt: now,
              });
            return Schema.decodeUnknownSync(Row)(
              database.sqlite.prepare(`${select} where id = ?`).get(operation.id),
            );
          })
          .immediate(),
      catch: (cause) => new DatabaseError({ operation: 'complete.integration.operation', cause }),
    });
  });
  return { status, list, submit };
});
export class Integrations extends Context.Service<
  Integrations,
  Effect.Success<typeof makeIntegrations>
>()('@froment/api/Integrations') {}
export const IntegrationsLive = Layer.effect(Integrations, makeIntegrations);
