import {
  AuditAction,
  AuditMetadata,
  AuditResourceType,
  Ulid,
  type AuditActionValue,
  type AuditMetadataValue,
  type AuditResourceTypeValue,
  type UlidValue,
} from '@froment/contracts';
import { Context, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Database } from '../database/database.js';

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

    return Audit.of({ insert });
  }),
);
