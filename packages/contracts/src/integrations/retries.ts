import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { IsoUtc } from '../temporal.js';
import { SafeInteger } from '../documents/lines.js';

export const IntegrationRetry = Schema.Struct({
  operationId: Ulid,
  attempts: SafeInteger,
  status: Schema.Literals(['waiting', 'processing', 'completed', 'exhausted', 'blocked']),
  nextAttemptAt: Schema.NullOr(IsoUtc),
  error: Schema.NullOr(
    Schema.Literals([
      'integration.unavailable',
      'integration.request_conflict',
      'integration.invalid_request',
      'integration.retry_permission',
      'integration.retry_interrupted',
      'integration.retry_database',
    ]),
  ),
});
export const IntegrationRetryList = Schema.Array(IntegrationRetry);
