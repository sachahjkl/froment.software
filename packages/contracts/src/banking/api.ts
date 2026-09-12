import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody, RequestBodyKind } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import { Ulid } from '../identifiers.js';
import {
  BankFailure,
  BankMatchHistory,
  BankPaymentList,
  BankImportRequest,
  BankImportResult,
  BankImportPreview,
  BankTransactionList,
  BankTransaction,
  BankMatchRequest,
  BankUnmatchRequest,
  BankMatchSuggestionList,
} from './contracts.js';

export class BankingApi extends HttpApiGroup.make('banking', { topLevel: true }).add(
  HttpApiEndpoint.get('bankPaymentList', '/api/banking/invoices/:invoiceId/payments', {
    params: { invoiceId: Ulid },
    success: BankPaymentList,
    error: BankFailure.members,
  }).pipe(
    requirePermissions([Permissions.bankRead, Permissions.invoiceRead]),
    authenticate,
    frontendSpecific,
  ),
  HttpApiEndpoint.get('bankMatchHistory', '/api/banking/transactions/:transactionId/history', {
    params: { transactionId: Ulid },
    success: BankMatchHistory,
    error: BankFailure.members,
  }).pipe(requirePermissions([Permissions.bankRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('bankTransactionList', '/api/banking/transactions', {
    success: BankTransactionList,
    error: BankFailure.members,
  }).pipe(requirePermissions([Permissions.bankRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('bankTransactionGet', '/api/banking/transactions/:transactionId', {
    params: { transactionId: Ulid },
    success: BankTransaction,
    error: BankFailure.members,
  }).pipe(requirePermissions([Permissions.bankRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get(
    'bankMatchSuggestionList',
    '/api/banking/transactions/:transactionId/suggestions',
    {
      params: { transactionId: Ulid },
      success: BankMatchSuggestionList,
      error: BankFailure.members,
    },
  ).pipe(
    requirePermissions([Permissions.bankRead, Permissions.invoiceRead]),
    authenticate,
    frontendSpecific,
  ),
  HttpApiEndpoint.post('bankImportPreview', '/api/banking/import/preview', {
    payload: BankImportRequest,
    success: BankImportPreview,
    error: BankFailure.members,
  })
    .annotate(RequestBodyKind, 'bank-import')
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.bankImport]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('bankImport', '/api/banking/import', {
    payload: BankImportRequest,
    success: BankImportResult,
    error: BankFailure.members,
  })
    .annotate(RequestBodyKind, 'bank-import')
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.bankImport]),
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
      requirePermissions([Permissions.bankReconcile]),
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
      requirePermissions([Permissions.bankReconcile]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
