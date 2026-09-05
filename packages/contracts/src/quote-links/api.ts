import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { requireBrowserOrigin } from '../api-policy/origin.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { DocumentIncomplete } from '../documents/contracts.js';
import { Permissions } from '../permissions.js';
import {
  PublicQuoteAccessRequest,
  PublicQuoteConsultation,
  PublicQuoteSignatureRequest,
  QuoteAcceptanceResult,
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  QuoteNotEditable,
  QuoteNotFound,
  QuotePdfRequired,
  QuoteSendRequest,
  QuoteSendResult,
  QuoteVersionConflict,
} from '../quotes/contracts.js';

export class QuoteLinksApi extends HttpApiGroup.make('quoteLinks', { topLevel: true }).add(
  HttpApiEndpoint.post('quoteSend', '/api/quotes/:quoteId/send', {
    params: { quoteId: Ulid },
    payload: QuoteSendRequest,
    success: QuoteSendResult,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuoteVersionConflict.pipe(HttpApiSchema.status(409)),
      QuoteNotEditable.pipe(HttpApiSchema.status(409)),
      QuotePdfRequired.pipe(HttpApiSchema.status(409)),
      DocumentIncomplete.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteSend]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
    ),
  HttpApiEndpoint.post('publicQuoteGet', '/api/public/quote-link', {
    payload: PublicQuoteAccessRequest,
    success: PublicQuoteConsultation,
    error: [
      QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requireBrowserOrigin, frontendSpecific),
  HttpApiEndpoint.post('publicQuotePdfDownload', '/api/public/quote-link/pdf', {
    payload: PublicQuoteAccessRequest,
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [
      QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requireBrowserOrigin, frontendSpecific),
  HttpApiEndpoint.post('publicQuoteSign', '/api/public/quote-link/signature', {
    payload: PublicQuoteSignatureRequest,
    success: QuoteAcceptanceResult,
    error: [
      QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
      QuoteLinkNotSignable.pipe(HttpApiSchema.status(409)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requireBrowserOrigin, frontendSpecific),
) {}
