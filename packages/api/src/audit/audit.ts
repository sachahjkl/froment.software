import {
  AuditAction,
  AuditEvent,
  AuditMetadata,
  AuditResourceType,
  Ulid,
  type AuditActionValue,
  type AuditEventValue,
  type AuditMetadataValue,
  type AuditResourceTypeValue,
  type UlidValue,
} from '@froment/contracts';
import { Context, DateTime, Effect, Fiber, Layer, Option, Schema, Tracer } from 'effect';
import { ulid } from 'ulid';

import { Database, DatabaseError } from '../database/database.js';
import { RequestContext } from '../http/request-context.js';

const AuditInsert = Schema.Struct({
  action: AuditAction,
  actorUserId: Schema.NullOr(Ulid),
  resourceType: AuditResourceType,
  resourceId: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  metadata: AuditMetadata,
  occurredAt: Schema.Int,
  requestId: Schema.NullOr(Schema.String.check(Schema.isUUID(4))),
  traceId: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/))),
  spanId: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[a-f0-9]{16}$/))),
});

export interface AuditInsert {
  readonly action: AuditActionValue;
  readonly actorUserId: UlidValue | null;
  readonly resourceType: AuditResourceTypeValue;
  readonly resourceId: string;
  readonly metadata?: AuditMetadataValue;
  readonly occurredAt: number;
}

export interface AuditService {
  readonly insert: (event: AuditInsert) => UlidValue;
  readonly listAffair: (
    quoteId: UlidValue,
  ) => Effect.Effect<ReadonlyArray<AuditEventValue>, DatabaseError>;
}

export class Audit extends Context.Service<Audit, AuditService>()('@froment/api/Audit') {}

export const AuditLive = Layer.effect(
  Audit,
  Effect.gen(function* () {
    const database = yield* Database;
    const statement = database.sqlite.prepare(
      `insert into audit_events
       (id, action, actor_user_id, resource_type, resource_id,
        request_id, trace_id, span_id, occurred_at, metadata)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const findEvent = database.sqlite.prepare('select 1 from audit_events where id = ?');

    const insert = (input: AuditInsert): UlidValue => {
      const fiber = Fiber.getCurrent();
      const requestContext =
        fiber === undefined
          ? undefined
          : Option.getOrUndefined(Context.getOption(fiber.context, RequestContext));
      const traceId = requestContext?.traceId.match(/^[a-f0-9]{32}$/)?.[0] ?? null;
      const spanId = requestContext?.spanId.match(/^[a-f0-9]{16}$/)?.[0] ?? null;
      const event = Schema.decodeUnknownSync(AuditInsert)({
        ...input,
        metadata: input.metadata ?? {},
        requestId: requestContext?.requestId ?? null,
        traceId,
        spanId,
      });
      const id = ulid(event.occurredAt);
      statement.run(
        id,
        event.action,
        event.actorUserId,
        event.resourceType,
        event.resourceId,
        event.requestId,
        event.traceId,
        event.spanId,
        event.occurredAt,
        JSON.stringify(event.metadata),
      );
      requestContext?.recordAuditEvent({
        id,
        action: event.action,
        actorUserId: event.actorUserId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        isCommitted: () => findEvent.get(id) !== undefined,
      });
      const span =
        fiber === undefined
          ? undefined
          : Option.getOrUndefined(Context.getOption(fiber.context, Tracer.ParentSpan));
      if (span?._tag === 'Span') {
        span.event('audit.event.recorded', BigInt(event.occurredAt) * 1_000_000n, {
          'audit.event.id': id,
          'audit.action': event.action,
          'resource.type': event.resourceType,
          'resource.id': event.resourceId,
        });
      }
      return id;
    };

    const listAffair = Effect.fn('Audit.listAffair')(function* (quoteId: UlidValue) {
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select id, action, actor_user_id as actorUserId,
                       resource_type as resourceType, resource_id as resourceId,
                       request_id as requestId, trace_id as traceId, span_id as spanId,
                      occurred_at as occurredAt, metadata
               from audit_events
               where (resource_type = 'quote' and resource_id = ?)
                  or (resource_type = 'invoice' and resource_id in (
                    select invoices.id from invoices
                    join orders on orders.id = invoices.order_id
                    where orders.quote_id = ?
                  ))
               order by occurred_at, id`,
            )
            .all(quoteId, quoteId)
            .map((row) => {
              const value = Schema.decodeUnknownSync(
                Schema.Struct({
                  id: Ulid,
                  action: AuditAction,
                  actorUserId: Schema.NullOr(Ulid),
                  resourceType: AuditResourceType,
                  resourceId: Schema.String,
                  requestId: Schema.NullOr(Schema.String),
                  traceId: Schema.NullOr(Schema.String),
                  spanId: Schema.NullOr(Schema.String),
                  occurredAt: Schema.Int,
                  metadata: Schema.String,
                }),
              )(row);
              return Schema.decodeUnknownSync(AuditEvent)({
                ...value,
                occurredAt: DateTime.formatIso(DateTime.makeUnsafe(value.occurredAt)),
                metadata: JSON.parse(value.metadata),
              });
            }),
        catch: (cause) => new DatabaseError({ operation: 'list.affair.audit.events', cause }),
      });
    });

    return Audit.of({ insert, listAffair });
  }),
);
