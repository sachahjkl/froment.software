import { Schema } from 'effect';

import { Ulid } from '../identifiers.js';

export const AuditAction = Schema.String.check(
  Schema.isPattern(/^[a-z]+(?:\.[a-z-]+)+$/),
  Schema.isMaxLength(80),
);
export type AuditAction = typeof AuditAction.Type;

export const AuditResourceType = Schema.String.check(
  Schema.isPattern(/^[a-z]+(?:-[a-z]+)*$/),
  Schema.isMaxLength(40),
);
export type AuditResourceType = typeof AuditResourceType.Type;

export const AuditMetadata = Schema.Record(
  Schema.String.check(Schema.isPattern(/^[a-z][a-zA-Z0-9]*$/), Schema.isMaxLength(40)),
  Schema.String.check(Schema.isMaxLength(500)),
);
export type AuditMetadata = typeof AuditMetadata.Type;

export const AuditEvent = Schema.Struct({
  id: Ulid,
  action: AuditAction,
  actorUserId: Schema.NullOr(Ulid),
  resourceType: AuditResourceType,
  resourceId: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  occurredAt: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
  ),
  metadata: AuditMetadata,
});
export type AuditEvent = typeof AuditEvent.Type;
