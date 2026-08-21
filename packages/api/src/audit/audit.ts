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
import { Context, DateTime, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Database, DatabaseError } from '../database/database.js';

const AuditInsert = Schema.Struct({
  action: AuditAction,
  actorUserId: Schema.NullOr(Ulid),
  resourceType: AuditResourceType,
  resourceId: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  metadata: AuditMetadata,
  occurredAt: Schema.Int,
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
       (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
       values (?, ?, ?, ?, ?, ?, ?)`,
    );

    const insert = (input: AuditInsert): UlidValue => {
      const event = Schema.decodeUnknownSync(AuditInsert)({
        ...input,
        metadata: input.metadata ?? {},
      });
      const id = ulid(event.occurredAt);
      statement.run(
        id,
        event.action,
        event.actorUserId,
        event.resourceType,
        event.resourceId,
        event.occurredAt,
        JSON.stringify(event.metadata),
      );
      return id;
    };

    const listAffair = Effect.fn('Audit.listAffair')(function* (quoteId: UlidValue) {
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select id, action, actor_user_id as actorUserId,
                      resource_type as resourceType, resource_id as resourceId,
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
        catch: (cause) => new DatabaseError({ operation: 'list affair audit events', cause }),
      });
    });

    return Audit.of({ insert, listAffair });
  }),
);
