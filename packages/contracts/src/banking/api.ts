import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import { Ulid } from '../identifiers.js';
import {
  BankFailure,
  BankImportRequest,
  BankImportResult,
  BankTransactionList,
  BankMatchRequest,
  BankUnmatchRequest,
} from './contracts.js';

export class BankingApi extends HttpApiGroup.make('banking', { topLevel: true }).add(
  HttpApiEndpoint.get('bankTransactionList', '/api/banking/transactions', {
    success: BankTransactionList,
    error: BankFailure.members,
  }).pipe(requirePermissions([Permissions.invoiceMarkPaid]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('bankImport', '/api/banking/import', {
    payload: BankImportRequest,
    success: BankImportResult,
    error: BankFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.invoiceMarkPaid]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('bankMatch', '/api/banking/transactions/:transactionId/match', {
    params: { transactionId: Ulid },
    payload: BankMatchRequest,
    success: BankTransactionList,
    error: BankFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.invoiceMarkPaid]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('bankUnmatch', '/api/banking/transactions/:transactionId/unmatch', {
    params: { transactionId: Ulid },
    payload: BankUnmatchRequest,
    success: BankTransactionList,
    error: BankFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.invoiceMarkPaid]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
