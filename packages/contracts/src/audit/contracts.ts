import { Schema } from 'effect';

import { Ulid } from '../identifiers.js';

export const AuditActions = [
  'administrator.bootstrapped',
  'api.token-created',
  'api.token-revoked',
  'api.token-used',
  'authentication.login-succeeded',
  'authentication.logout',
  'authentication.refresh-replay-detected',
  'authentication.sessions-revoked',
  'client.access-created',
  'client.access-replaced',
  'client.access-revoked',
  'client.archived',
  'client.created',
  'client.reactivated',
  'client.updated',
  'document.rendered',
  'invoice.created',
  'invoice.issued',
  'invoice.marked-paid',
  'invoice.revised',
  'invoice.voided',
  'issuer.updated',
  'quote.accepted',
  'quote.cancelled',
  'quote.condition-preset-created',
  'quote.condition-preset-deleted',
  'quote.condition-preset-updated',
  'quote.created',
  'quote.expired',
  'quote.revised',
  'quote.sent',
] as const;
export const AuditAction = Schema.Literals(AuditActions);
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
  requestId: Schema.NullOr(Schema.String.check(Schema.isUUID(4))),
  traceId: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[a-f0-9]{32}$/))),
  spanId: Schema.NullOr(Schema.String.check(Schema.isPattern(/^[a-f0-9]{16}$/))),
  occurredAt: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
  ),
  metadata: AuditMetadata,
});
export type AuditEvent = typeof AuditEvent.Type;
