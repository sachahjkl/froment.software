import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import { Ulid } from '../identifiers.js';
import {
  LedgerConflict,
  LedgerEntry,
  LedgerList,
  LedgerPeriod,
  LedgerRequest,
  LedgerReverse,
} from './ledger.js';

export class BankLedgerApi extends HttpApiGroup.make('bankLedger', { topLevel: true }).add(
  HttpApiEndpoint.get('bankLedgerList', '/api/banking/ledger', {
    query: LedgerPeriod,
    success: LedgerList,
    error: [LedgerConflict],
  }).pipe(requirePermissions([Permissions.ledgerRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('bankLedgerExport', '/api/banking/ledger/export', {
    query: LedgerPeriod,
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/csv' })),
    error: [LedgerConflict],
  }).pipe(requirePermissions([Permissions.ledgerRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('bankLedgerPost', '/api/banking/ledger', {
    payload: LedgerRequest,
    success: LedgerEntry,
    error: [LedgerConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.ledgerPost, Permissions.ledgerRead]),
      authenticate,
      frontendSpecific,
    ),
  HttpApiEndpoint.post('bankLedgerReverse', '/api/banking/ledger/:entryId/reverse', {
    params: { entryId: Ulid },
    payload: LedgerReverse,
    success: LedgerEntry,
    error: [LedgerConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.ledgerPost, Permissions.ledgerRead]),
      authenticate,
      frontendSpecific,
    ),
) {}
