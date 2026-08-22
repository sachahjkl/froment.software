import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { RevisionVersionParameter } from '../api-common.js';
import { requireBrowserOrigin } from '../api-policy/origin.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { AuditEvent } from '../audit/contracts.js';
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
  IssuerSettings,
  IssuerSettingsUpdateRequest,
  QuotePreviewUnavailable,
} from '../documents/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  QuoteConditionPreset,
  QuoteConditionPresetList,
  QuoteConditionPresetNameConflict,
  QuoteConditionPresetNotFound,
  QuoteConditionPresetWriteRequest,
} from '../quote-condition-presets/contracts.js';
import {
  PublicQuoteAccessRequest,
  PublicQuoteConsultation,
  PublicQuoteSignatureRequest,
  QuoteAcceptanceResult,
  QuoteAmountTooLarge,
  QuoteCancelRequest,
  QuoteCreateRequest,
  QuoteDetail,
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  QuoteList,
  QuoteNotEditable,
  QuoteNotFound,
  QuotePdfRequired,
  QuoteRevisionCreateRequest,
  QuoteSendRequest,
  QuoteSendResult,
  QuoteVersionConflict,
} from '../quotes/contracts.js';

export class QuotesApi extends HttpApiGroup.make('quotes', { topLevel: true }).add(
  HttpApiEndpoint.get('quoteConditionPresetList', '/api/quote-condition-presets', {
    success: QuoteConditionPresetList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead]), frontendSpecific),
  HttpApiEndpoint.post('quoteConditionPresetCreate', '/api/quote-condition-presets', {
    payload: QuoteConditionPresetWriteRequest,
    success: QuoteConditionPreset,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteConditionPresetNameConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.put('quoteConditionPresetUpdate', '/api/quote-condition-presets/:presetId', {
    params: { presetId: Ulid },
    payload: QuoteConditionPresetWriteRequest,
    success: QuoteConditionPreset,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteConditionPresetNotFound.pipe(HttpApiSchema.status(404)),
      QuoteConditionPresetNameConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.delete('quoteConditionPresetDelete', '/api/quote-condition-presets/:presetId', {
    params: { presetId: Ulid },
    success: QuoteConditionPreset,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteConditionPresetNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(
    requirePermissions([Permissions.quoteUpdate]),
    rateLimit(RateLimits.sixtyPerMinute),
    frontendSpecific,
  ),
  HttpApiEndpoint.get('issuerSettingsGet', '/api/issuer-settings', {
    success: IssuerSettings,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.templateRead]), frontendSpecific),
  HttpApiEndpoint.put('issuerSettingsUpdate', '/api/issuer-settings', {
    payload: IssuerSettingsUpdateRequest,
    success: IssuerSettings,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.templateSelect]),
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.get('quoteList', '/api/quotes', {
    success: QuoteList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead])),
  HttpApiEndpoint.get('quoteGet', '/api/quotes/:quoteId', {
    params: { quoteId: Ulid },
    success: QuoteDetail,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead])),
  HttpApiEndpoint.get('affairEventList', '/api/affairs/:quoteId/events', {
    params: { quoteId: Ulid },
    success: Schema.Array(AuditEvent),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead, Permissions.auditRead]), frontendSpecific),
  HttpApiEndpoint.get('quotePreview', '/api/quotes/:quoteId/revisions/:version/preview', {
    params: { quoteId: Ulid, version: RevisionVersionParameter },
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(requirePermissions([Permissions.documentRender]), frontendSpecific),
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
  }).pipe(requirePermissions([Permissions.documentDownload])),
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
    .pipe(requirePermissions([Permissions.quoteCreate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('quoteSend', '/api/quotes/:quoteId/send', {
    params: { quoteId: Ulid },
    payload: QuoteSendRequest,
    success: QuoteSendResult,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuoteVersionConflict.pipe(HttpApiSchema.status(409)),
      QuoteNotEditable.pipe(HttpApiSchema.status(409)),
      QuotePdfRequired.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.quoteSend]), rateLimit(RateLimits.tenPerMinute)),
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
    .pipe(requirePermissions([Permissions.quoteDelete]), rateLimit(RateLimits.sixtyPerMinute)),
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
    .pipe(requirePermissions([Permissions.quoteUpdate]), rateLimit(RateLimits.sixtyPerMinute)),
) {}
