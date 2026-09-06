import type { IntegrationOperationValue, IntegrationSubmissionValue } from '@froment/contracts';
import { DateTime } from 'effect';
import { ulid } from 'ulid';
import type { Database } from '../database/database.js';
import type { Audit } from '../audit/audit.js';

export const recordOperation = (
  database: Database['Service'],
  audit: Audit['Service'],
  request: IntegrationSubmissionValue,
  actorUserId: string,
  now: number,
): IntegrationOperationValue => {
  const operation: IntegrationOperationValue = {
    id: ulid(now),
    request,
    receipt: null,
    createdAt: DateTime.formatIso(DateTime.makeUnsafe(now)),
    createdByUserId: actorUserId,
  };
  database.sqlite
    .prepare(
      'insert into integration_operations (id, request_id, request, receipt, created_at, created_by_user_id) values (?, ?, ?, null, ?, ?)',
    )
    .run(
      operation.id,
      request.requestId,
      JSON.stringify(request),
      operation.createdAt,
      actorUserId,
    );
  audit.insert({
    action: 'integration.requested',
    actorUserId,
    resourceType: 'integration',
    resourceId: operation.id,
    metadata: { kind: request.kind },
    occurredAt: now,
  });
  return operation;
};
