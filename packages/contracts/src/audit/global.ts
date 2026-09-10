import { Schema } from 'effect';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { AuditAction, AuditEvent, AuditResourceType } from './contracts.js';

export const GlobalAuditEvent = Schema.Struct({
  id: AuditEvent.fields.id,
  action: AuditEvent.fields.action,
  actorUserId: AuditEvent.fields.actorUserId,
  resourceType: AuditEvent.fields.resourceType,
  resourceId: AuditEvent.fields.resourceId,
  occurredAt: AuditEvent.fields.occurredAt,
}).annotate({ identifier: 'GlobalAuditEvent' });
export interface GlobalAuditEvent extends Schema.Schema.Type<typeof GlobalAuditEvent> {}

export const GlobalAuditQuery = Schema.Struct({
  cursor: Schema.optionalKey(Ulid),
  direction: Schema.optionalKey(Schema.Literals(['older', 'newer'])),
  limit: Schema.optionalKey(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0))),
  action: Schema.optionalKey(AuditAction),
  resourceType: Schema.optionalKey(AuditResourceType),
})
  .check(
    Schema.makeFilter((query) => query.direction !== 'newer' || query.cursor !== undefined, {
      message: 'audit.newer_requires_cursor',
    }),
  )
  .annotate({ identifier: 'GlobalAuditQuery' });
export interface GlobalAuditQuery extends Schema.Schema.Type<typeof GlobalAuditQuery> {}

export const GlobalAuditPage = Schema.Struct({
  items: Schema.Array(GlobalAuditEvent),
  previousCursor: Schema.NullOr(Ulid),
  nextCursor: Schema.NullOr(Ulid),
}).annotate({ identifier: 'GlobalAuditPage' });
export interface GlobalAuditPage extends Schema.Schema.Type<typeof GlobalAuditPage> {}

export class InvalidAuditQuery extends Schema.TaggedError<InvalidAuditQuery>()(
  'InvalidAuditQuery',
  { code: Schema.Literal('audit.invalid_query') },
) {}

export class AuditUnavailable extends Schema.TaggedError<AuditUnavailable>()('AuditUnavailable', {
  code: Schema.Literal('audit.unavailable'),
}) {}

export const GlobalAuditFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  InvalidAuditQuery,
  AuditUnavailable,
]);
export type GlobalAuditFailure = typeof GlobalAuditFailure.Type;
