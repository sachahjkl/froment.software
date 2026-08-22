import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { RevisionVersionParameter } from '../api-common.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { ClientArchived, ClientNotFound } from '../clients/contracts.js';
import {
  DocumentArtifact,
  DocumentNotFound,
  QuotePreviewUnavailable,
} from '../documents/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  QuoteAmountTooLarge,
  QuoteCancelRequest,
  QuoteCreateRequest,
  QuoteDetail,
  QuoteList,
  QuoteNotEditable,
  QuoteNotFound,
  QuoteRevisionCreateRequest,
  QuoteVersionConflict,
} from '../quotes/contracts.js';

export class QuotesApi extends HttpApiGroup.make('quotes', { topLevel: true }).add(
  HttpApiEndpoint.get('quoteList', '/api/quotes', {
    success: QuoteList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead]), authenticate),
  HttpApiEndpoint.get('quoteGet', '/api/quotes/:quoteId', {
    params: { quoteId: Ulid },
    success: QuoteDetail,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead]), authenticate),
  HttpApiEndpoint.get('quotePreview', '/api/quotes/:quoteId/revisions/:version/preview', {
    params: { quoteId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(requirePermissions([Permissions.documentRender]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('quotePdfRender', '/api/quotes/:quoteId/revisions/:version/pdf', {
    params: { quoteId: Ulid, version: RevisionVersionParameter },
    success: DocumentArtifact,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(
    requirePermissions([Permissions.documentRender]),
    authenticate,
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
  HttpApiEndpoint.get('quotePdfDownload', '/api/quotes/:quoteId/revisions/:version/pdf', {
    params: { quoteId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      DocumentNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.documentDownload]), authenticate),
  HttpApiEndpoint.post('quoteCreate', '/api/quotes', {
    payload: QuoteCreateRequest,
    success: QuoteDetail,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
      QuoteAmountTooLarge.pipe(HttpApiSchema.status(422)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteCreate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
  HttpApiEndpoint.post('quoteCancel', '/api/quotes/:quoteId/cancel', {
    params: { quoteId: Ulid },
    payload: QuoteCancelRequest,
    success: QuoteDetail,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuoteVersionConflict.pipe(HttpApiSchema.status(409)),
      QuoteNotEditable.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteDelete]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
  HttpApiEndpoint.post('quoteRevisionCreate', '/api/quotes/:quoteId/revisions', {
    params: { quoteId: Ulid },
    payload: QuoteRevisionCreateRequest,
    success: QuoteDetail,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuoteVersionConflict.pipe(HttpApiSchema.status(409)),
      QuoteNotEditable.pipe(HttpApiSchema.status(409)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
      QuoteAmountTooLarge.pipe(HttpApiSchema.status(422)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
) {}
