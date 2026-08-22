import { Schema } from 'effect';
import type { Language } from '@froment/l10n';
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from 'effect/unstable/httpapi';

import { HealthStatus } from './status.js';
import {
  AuthenticationRejected,
  AuthenticationRateLimited,
  LoginRequest,
  PermissionDenied,
  RequestRateLimited,
  AuthenticationRequired,
  CsrfRejected,
  SessionRejected,
  SessionStatus,
} from './authentication.js';
import {
  BootstrapRejected,
  BootstrapRateLimited,
  BootstrapRequest,
  BootstrapResult,
  BootstrapStatus,
  BootstrapUnavailable,
} from './bootstrap.js';
import {
  ClientAccess,
  ClientArchived,
  ClientCreateRequest,
  ClientList,
  ClientNotFound,
  ClientSummary,
  ClientUpdateRequest,
  ClientVersionConflict,
} from './clients.js';
import { Ulid } from './identifiers.js';
import { AuditEvent } from './audit.js';
import { OrderDocumentArtifact, OrderList, OrderNotFound } from './orders.js';
import {
  QuoteCancelRequest,
  QuoteCreateRequest,
  QuoteAmountTooLarge,
  QuoteDetail,
  QuoteList,
  QuoteNotFound,
  QuoteNotEditable,
  QuotePreviewUnavailable,
  QuoteRevisionCreateRequest,
  QuoteVersionConflict,
  IssuerSettings,
  IssuerSettingsUpdateRequest,
  DocumentArtifact,
  DocumentNotFound,
  PublicQuoteAccessRequest,
  PublicQuoteConsultation,
  PublicQuoteSignatureRequest,
  QuoteAcceptanceResult,
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  QuotePdfRequired,
  QuoteSendRequest,
  QuoteSendResult,
} from './quotes.js';
import { DeploymentMetadata } from './version.js';
import {
  QuoteConditionPreset,
  QuoteConditionPresetList,
  QuoteConditionPresetNameConflict,
  QuoteConditionPresetNotFound,
  QuoteConditionPresetWriteRequest,
} from './quote-condition-presets.js';
import {
  CalendarDateText,
  InvoiceAlreadyExists,
  InvoiceAmountTooLarge,
  InvoiceCreateRequest,
  InvoiceDetail,
  InvoiceDocumentArtifact,
  InvoiceInvalidDates,
  InvoiceInvalidTransition,
  InvoiceIssueRequest,
  InvoiceIssueResult,
  InvoiceList,
  InvoiceNotEditable,
  InvoiceNotFound,
  InvoiceOrderNotFound,
  InvoiceRevisionCreateRequest,
  InvoiceTransitionRequest,
  InvoiceVersionConflict,
} from './invoices.js';
import { ClientInvoiceList, ClientOrderList, ClientQuoteList } from './client-portal.js';
import { ApiBrowserRequest, ApiRequestBody } from './api-authentication.js';
import { Permissions } from './permissions.js';
import {
  IntegrationTokenCreateRequest,
  IntegrationTokenCreated,
  IntegrationTokenInvalidExpiration,
  IntegrationTokenInvalidCursor,
  IntegrationTokenListQuery,
  IntegrationTokenNameConflict,
  IntegrationTokenNotFound,
  IntegrationTokenPage,
} from './integration-tokens.js';
import { localizeOpenApi } from './api-documentation.js';
import { requireBrowserOrigin } from './api-policy/origin.js';
import { requirePermissions } from './api-policy/permissions.js';
import { rateLimit, RateLimits } from './api-policy/rate-limit.js';
import { frontendSpecific } from './api-policy/visibility.js';

export const RevisionVersionParameter = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);

export class SystemApi extends HttpApiGroup.make('system', { topLevel: true })
  .add(
    HttpApiEndpoint.get('health', '/api/health', {
      success: HealthStatus,
    }),
    HttpApiEndpoint.get('version', '/api/version', {
      success: DeploymentMetadata,
    }),
    HttpApiEndpoint.get('bootstrapStatus', '/api/bootstrap', {
      success: BootstrapStatus,
    }),
    HttpApiEndpoint.post('bootstrapCreate', '/api/bootstrap', {
      payload: BootstrapRequest,
      success: BootstrapResult,
      error: [
        BootstrapRejected.pipe(HttpApiSchema.status(401)),
        BootstrapUnavailable.pipe(HttpApiSchema.status(409)),
        BootstrapRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    })
      .middleware(ApiRequestBody)
      .middleware(ApiBrowserRequest),
    HttpApiEndpoint.post('login', '/api/auth/login', {
      payload: LoginRequest,
      success: SessionStatus,
      error: [
        AuthenticationRejected.pipe(HttpApiSchema.status(401)),
        AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    })
      .middleware(ApiRequestBody)
      .middleware(ApiBrowserRequest),
    HttpApiEndpoint.get('sessionStatus', '/api/auth/session', {
      success: SessionStatus,
    }),
    HttpApiEndpoint.post('logout', '/api/auth/logout', {
      success: SessionStatus,
      error: SessionRejected.pipe(HttpApiSchema.status(401)),
    }).middleware(ApiBrowserRequest),
  )
  .annotate(OpenApi.Exclude, true) {}

export class ClientsApi extends HttpApiGroup.make('clients', { topLevel: true }).add(
  HttpApiEndpoint.get('clientList', '/api/clients', {
    success: ClientList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.clientRead])),
  HttpApiEndpoint.get('clientGet', '/api/clients/:clientId', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientRead])),
  HttpApiEndpoint.post('clientCreate', '/api/clients', {
    payload: ClientCreateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.clientCreate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.put('clientUpdate', '/api/clients/:clientId', {
    params: { clientId: Ulid },
    payload: ClientUpdateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
      ClientVersionConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.clientUpdate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('clientArchive', '/api/clients/:clientId/archive', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientArchive]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('clientReactivate', '/api/clients/:clientId/reactivate', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientArchive]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('clientAccessCreate', '/api/clients/:clientId/access', {
    params: { clientId: Ulid },
    success: ClientAccess,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(
    requirePermissions([Permissions.clientAccessCreate]),
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
) {}

export class OrdersApi extends HttpApiGroup.make('orders', { topLevel: true }).add(
  HttpApiEndpoint.get('orderList', '/api/orders', {
    success: OrderList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.orderRead])),
  HttpApiEndpoint.get('orderPreview', '/api/orders/:orderId/preview', {
    params: { orderId: Ulid },
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      OrderNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(requirePermissions([Permissions.documentRender]), frontendSpecific),
  HttpApiEndpoint.post('orderPdfRender', '/api/orders/:orderId/pdf', {
    params: { orderId: Ulid },
    success: OrderDocumentArtifact,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      OrderNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(
    requirePermissions([Permissions.documentRender]),
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
  HttpApiEndpoint.get('orderPdfDownload', '/api/orders/:orderId/pdf', {
    params: { orderId: Ulid },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      DocumentNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.documentDownload])),
) {}

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

const invoiceReadErrors = [
  AuthenticationRequired.pipe(HttpApiSchema.status(401)),
  PermissionDenied.pipe(HttpApiSchema.status(403)),
];
const invoiceWriteErrors = [
  ...invoiceReadErrors,
  CsrfRejected.pipe(HttpApiSchema.status(403)),
  RequestRateLimited.pipe(HttpApiSchema.status(429)),
];
const InvoiceCreatePayload = Schema.Struct({
  ...InvoiceCreateRequest.fields,
  serviceDate: CalendarDateText,
  dueDate: CalendarDateText,
}).annotate({ identifier: 'InvoiceCreateRequest' });
const InvoiceRevisionCreatePayload = Schema.Struct({
  ...InvoiceRevisionCreateRequest.fields,
  serviceDate: CalendarDateText,
  dueDate: CalendarDateText,
}).annotate({ identifier: 'InvoiceRevisionCreateRequest' });

export class InvoicesApi extends HttpApiGroup.make('invoices', { topLevel: true }).add(
  HttpApiEndpoint.get('invoiceList', '/api/invoices', {
    success: InvoiceList,
    error: invoiceReadErrors,
  }).pipe(requirePermissions([Permissions.invoiceRead])),
  HttpApiEndpoint.get('invoiceGet', '/api/invoices/:invoiceId', {
    params: { invoiceId: Ulid },
    success: InvoiceDetail,
    error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.invoiceRead])),
  HttpApiEndpoint.get('invoicePreview', '/api/invoices/:invoiceId/revisions/:version/preview', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' })),
    error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.documentRender]), frontendSpecific),
  HttpApiEndpoint.post('invoicePdfRender', '/api/invoices/:invoiceId/revisions/:version/pdf', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: InvoiceDocumentArtifact,
    error: [...invoiceWriteErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(
    requirePermissions([Permissions.documentRender]),
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
  HttpApiEndpoint.get('invoicePdfDownload', '/api/invoices/:invoiceId/revisions/:version/pdf', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [...invoiceReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.documentDownload])),
  HttpApiEndpoint.post('invoiceCreate', '/api/invoices', {
    payload: InvoiceCreatePayload,
    success: InvoiceDetail,
    error: [
      ...invoiceWriteErrors,
      InvoiceOrderNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceAlreadyExists.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidDates.pipe(HttpApiSchema.status(422)),
      InvoiceAmountTooLarge.pipe(HttpApiSchema.status(422)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.invoiceCreate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('invoiceRevisionCreate', '/api/invoices/:invoiceId/revisions', {
    params: { invoiceId: Ulid },
    payload: InvoiceRevisionCreatePayload,
    success: InvoiceDetail,
    error: [
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceNotEditable.pipe(HttpApiSchema.status(409)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidDates.pipe(HttpApiSchema.status(422)),
      InvoiceAmountTooLarge.pipe(HttpApiSchema.status(422)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.invoiceUpdate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('invoiceIssue', '/api/invoices/:invoiceId/issue', {
    params: { invoiceId: Ulid },
    payload: InvoiceIssueRequest,
    success: InvoiceIssueResult,
    error: [
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidDates.pipe(HttpApiSchema.status(422)),
      InvoiceInvalidTransition.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.invoiceIssue]), rateLimit(RateLimits.tenPerMinute)),
  HttpApiEndpoint.post('invoiceMarkPaid', '/api/invoices/:invoiceId/mark-paid', {
    params: { invoiceId: Ulid },
    payload: InvoiceTransitionRequest,
    success: InvoiceDetail,
    error: [
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidTransition.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.invoiceMarkPaid]), rateLimit(RateLimits.tenPerMinute)),
  HttpApiEndpoint.post('invoiceVoid', '/api/invoices/:invoiceId/void', {
    params: { invoiceId: Ulid },
    payload: InvoiceTransitionRequest,
    success: InvoiceDetail,
    error: [
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidTransition.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.invoiceVoid]), rateLimit(RateLimits.tenPerMinute)),
) {}

const clientReadErrors = [
  AuthenticationRequired.pipe(HttpApiSchema.status(401)),
  PermissionDenied.pipe(HttpApiSchema.status(403)),
];

export class ClientPortalApi extends HttpApiGroup.make('clientPortal', { topLevel: true })
  .add(
    HttpApiEndpoint.get('clientQuoteList', '/api/client/quotes', {
      success: ClientQuoteList,
      error: clientReadErrors,
    }),
    HttpApiEndpoint.get('clientOrderList', '/api/client/orders', {
      success: ClientOrderList,
      error: clientReadErrors,
    }),
    HttpApiEndpoint.get('clientInvoiceList', '/api/client/invoices', {
      success: ClientInvoiceList,
      error: clientReadErrors,
    }),
    HttpApiEndpoint.get('clientQuotePdf', '/api/client/quotes/:quoteId/pdf', {
      params: { quoteId: Ulid },
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [...clientReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
    }),
    HttpApiEndpoint.get('clientInvoicePdf', '/api/client/invoices/:invoiceId/pdf', {
      params: { invoiceId: Ulid },
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [...clientReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
    }),
    HttpApiEndpoint.get('clientOrderPdf', '/api/client/orders/:orderId/pdf', {
      params: { orderId: Ulid },
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [...clientReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
    }),
  )
  .annotate(OpenApi.Exclude, true) {}

export class IntegrationTokensApi extends HttpApiGroup.make('integrationTokens', {
  topLevel: true,
})
  .add(
    HttpApiEndpoint.get('integrationTokenList', '/api/integration-tokens', {
      query: IntegrationTokenListQuery,
      success: IntegrationTokenPage,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        IntegrationTokenInvalidCursor.pipe(HttpApiSchema.status(400)),
      ],
    }).pipe(requirePermissions([Permissions.integrationTokenManage]), frontendSpecific),
    HttpApiEndpoint.post('integrationTokenCreate', '/api/integration-tokens', {
      payload: IntegrationTokenCreateRequest,
      success: IntegrationTokenCreated,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        CsrfRejected.pipe(HttpApiSchema.status(403)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
        IntegrationTokenNameConflict.pipe(HttpApiSchema.status(409)),
        IntegrationTokenInvalidExpiration.pipe(HttpApiSchema.status(422)),
      ],
    })
      .middleware(ApiRequestBody)
      .pipe(
        requirePermissions([Permissions.integrationTokenManage]),
        rateLimit(RateLimits.tenPerMinute),
        frontendSpecific,
      ),
    HttpApiEndpoint.post('integrationTokenRevoke', '/api/integration-tokens/:tokenId/revoke', {
      params: { tokenId: Ulid },
      success: IntegrationTokenCreated.fields.token,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        CsrfRejected.pipe(HttpApiSchema.status(403)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
        IntegrationTokenNotFound.pipe(HttpApiSchema.status(404)),
      ],
    }).pipe(
      requirePermissions([Permissions.integrationTokenManage]),
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  )
  .annotate(OpenApi.Exclude, true) {}

export class Api extends HttpApi.make('froment-api')
  .add(SystemApi)
  .add(ClientsApi)
  .add(OrdersApi)
  .add(QuotesApi)
  .add(InvoicesApi)
  .add(ClientPortalApi)
  .add(IntegrationTokensApi)
  .annotateMerge(OpenApi.annotations({ version: 'latest' })) {}

export const apiForLanguage = (language: Language) =>
  Api.annotateMerge(
    OpenApi.annotations({ transform: (specification) => localizeOpenApi(specification, language) }),
  );
