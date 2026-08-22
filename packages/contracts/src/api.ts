import { Schema } from 'effect';
import type * as HttpMethod from 'effect/unstable/http/HttpMethod';
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
import {
  ApiAuthentication,
  ApiAuthorization,
  ApiWriteProtection,
  MutationRateLimit,
  RequiredPermission,
} from './api-authentication.js';
import type { PermissionCode } from './permissions.js';
import {
  IntegrationTokenCreateRequest,
  IntegrationTokenCreated,
  IntegrationTokenInvalidExpiration,
  IntegrationTokenListQuery,
  IntegrationTokenNameConflict,
  IntegrationTokenNotFound,
  IntegrationTokenPage,
} from './integration-tokens.js';

const documentedRead =
  (permission: PermissionCode, summary: string, description: string) =>
  <
    Identifier extends string,
    Method extends HttpMethod.HttpMethod,
    Path extends string,
    Params extends Schema.Top,
    Query extends Schema.Top,
    Payload extends Schema.Top,
    Headers extends Schema.Top,
    Success extends Schema.Top,
    Error extends Schema.Top,
    Middleware,
    MiddlewareServices,
  >(
    endpoint: HttpApiEndpoint.HttpApiEndpoint<
      Identifier,
      Method,
      Path,
      Params,
      Query,
      Payload,
      Headers,
      Success,
      Error,
      Middleware,
      MiddlewareServices
    >,
  ) =>
    endpoint
      .annotate(RequiredPermission, permission)
      .middleware(ApiAuthorization)
      .middleware(ApiAuthentication)
      .annotateMerge(
        OpenApi.annotations({
          summary,
          description: `${description}\n\nRequired permission: \`${permission}\`.`,
          override: { 'x-required-permission': permission },
        }),
      );

const documentedWrite =
  (permission: PermissionCode, summary: string, description: string, rateLimit = 60) =>
  <
    Identifier extends string,
    Method extends HttpMethod.HttpMethod,
    Path extends string,
    Params extends Schema.Top,
    Query extends Schema.Top,
    Payload extends Schema.Top,
    Headers extends Schema.Top,
    Success extends Schema.Top,
    Error extends Schema.Top,
    Middleware,
    MiddlewareServices,
  >(
    endpoint: HttpApiEndpoint.HttpApiEndpoint<
      Identifier,
      Method,
      Path,
      Params,
      Query,
      Payload,
      Headers,
      Success,
      Error,
      Middleware,
      MiddlewareServices
    >,
  ) =>
    endpoint
      .annotate(RequiredPermission, permission)
      .annotate(MutationRateLimit, rateLimit)
      .middleware(ApiWriteProtection)
      .middleware(ApiAuthorization)
      .middleware(ApiAuthentication)
      .annotateMerge(
        OpenApi.annotations({
          summary,
          description: `${description}\n\nRequired permission: \`${permission}\`.`,
          override: { 'x-required-permission': permission },
        }),
      );

const internal = <
  Identifier extends string,
  Method extends HttpMethod.HttpMethod,
  Path extends string,
  Params extends Schema.Top,
  Query extends Schema.Top,
  Payload extends Schema.Top,
  Headers extends Schema.Top,
  Success extends Schema.Top,
  Error extends Schema.Top,
  Middleware,
  MiddlewareServices,
>(
  endpoint: HttpApiEndpoint.HttpApiEndpoint<
    Identifier,
    Method,
    Path,
    Params,
    Query,
    Payload,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareServices
  >,
) => endpoint.annotate(OpenApi.Exclude, true);

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
    }),
    HttpApiEndpoint.post('login', '/api/auth/login', {
      payload: LoginRequest,
      success: SessionStatus,
      error: [
        AuthenticationRejected.pipe(HttpApiSchema.status(401)),
        AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    }),
    HttpApiEndpoint.get('sessionStatus', '/api/auth/session', {
      success: SessionStatus,
    }),
    HttpApiEndpoint.post('logout', '/api/auth/logout', {
      success: SessionStatus,
      error: SessionRejected.pipe(HttpApiSchema.status(401)),
    }),
  )
  .annotate(OpenApi.Exclude, true) {}

export class ClientsApi extends HttpApiGroup.make('clients', { topLevel: true })
  .add(
    HttpApiEndpoint.get('clientList', '/api/clients', {
      success: ClientList,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
      ],
    }).pipe(documentedRead('client.read', 'List clients', 'Lists active and archived clients.')),
    HttpApiEndpoint.get('clientGet', '/api/clients/:clientId', {
      params: { clientId: Ulid },
      success: ClientSummary,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        ClientNotFound.pipe(HttpApiSchema.status(404)),
      ],
    }).pipe(documentedRead('client.read', 'Get a client', 'Returns one client by identifier.')),
    HttpApiEndpoint.post('clientCreate', '/api/clients', {
      payload: ClientCreateRequest,
      success: ClientSummary,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        CsrfRejected.pipe(HttpApiSchema.status(403)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    }).pipe(documentedWrite('client.create', 'Create a client', 'Creates a client.')),
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
    }).pipe(documentedWrite('client.update', 'Update a client', 'Updates an active client.')),
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
    }).pipe(documentedWrite('client.archive', 'Archive a client', 'Archives a client.')),
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
    }).pipe(
      documentedWrite('client.archive', 'Reactivate a client', 'Reactivates an archived client.'),
    ),
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
    }).pipe(internal),
  )
  .annotateMerge(
    OpenApi.annotations({ title: 'Clients', description: 'Client records and lifecycle.' }),
  ) {}

export class OrdersApi extends HttpApiGroup.make('orders', { topLevel: true })
  .add(
    HttpApiEndpoint.get('orderList', '/api/orders', {
      success: OrderList,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
      ],
    }).pipe(
      documentedRead('order.read', 'List orders', 'Lists orders created from accepted quotes.'),
    ),
    HttpApiEndpoint.get('orderPreview', '/api/orders/:orderId/preview', {
      params: { orderId: Ulid },
      success: Schema.String.pipe(
        HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' }),
      ),
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        OrderNotFound.pipe(HttpApiSchema.status(404)),
        QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
      ],
    }).pipe(internal),
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
    }).pipe(internal),
    HttpApiEndpoint.get('orderPdfDownload', '/api/orders/:orderId/pdf', {
      params: { orderId: Ulid },
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        DocumentNotFound.pipe(HttpApiSchema.status(404)),
      ],
    }).pipe(
      documentedRead(
        'document.download',
        'Download an order PDF',
        'Downloads an existing order PDF.',
      ),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({ title: 'Orders', description: 'Orders and their generated documents.' }),
  ) {}

export class QuotesApi extends HttpApiGroup.make('quotes', { topLevel: true })
  .add(
    HttpApiEndpoint.get('quoteConditionPresetList', '/api/quote-condition-presets', {
      success: QuoteConditionPresetList,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
      ],
    }).pipe(internal),
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
    }).pipe(internal),
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
    }).pipe(internal),
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
    }).pipe(internal),
    HttpApiEndpoint.get('issuerSettingsGet', '/api/issuer-settings', {
      success: IssuerSettings,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
      ],
    }).pipe(internal),
    HttpApiEndpoint.put('issuerSettingsUpdate', '/api/issuer-settings', {
      payload: IssuerSettingsUpdateRequest,
      success: IssuerSettings,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        CsrfRejected.pipe(HttpApiSchema.status(403)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    }).pipe(internal),
    HttpApiEndpoint.get('quoteList', '/api/quotes', {
      success: QuoteList,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
      ],
    }).pipe(documentedRead('quote.read', 'List quotes', 'Lists quotes and their latest revision.')),
    HttpApiEndpoint.get('quoteGet', '/api/quotes/:quoteId', {
      params: { quoteId: Ulid },
      success: QuoteDetail,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        QuoteNotFound.pipe(HttpApiSchema.status(404)),
      ],
    }).pipe(
      documentedRead('quote.read', 'Get a quote', 'Returns a quote and all of its revisions.'),
    ),
    HttpApiEndpoint.get('affairEventList', '/api/affairs/:quoteId/events', {
      params: { quoteId: Ulid },
      success: Schema.Array(AuditEvent),
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
      ],
    }).pipe(internal),
    HttpApiEndpoint.get('quotePreview', '/api/quotes/:quoteId/revisions/:version/preview', {
      params: { quoteId: Ulid, version: RevisionVersionParameter },
      success: Schema.String.pipe(
        HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' }),
      ),
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        QuoteNotFound.pipe(HttpApiSchema.status(404)),
        QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
      ],
    }).pipe(internal),
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
    }).pipe(internal),
    HttpApiEndpoint.get('quotePdfDownload', '/api/quotes/:quoteId/revisions/:version/pdf', {
      params: { quoteId: Ulid, version: RevisionVersionParameter },
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        DocumentNotFound.pipe(HttpApiSchema.status(404)),
      ],
    }).pipe(
      documentedRead(
        'document.download',
        'Download a quote PDF',
        'Downloads an existing quote revision PDF.',
      ),
    ),
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
    }).pipe(
      documentedWrite('quote.create', 'Create a quote', 'Creates the first revision of a quote.'),
    ),
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
    }).pipe(
      documentedWrite(
        'quote.send',
        'Send a quote',
        'Creates a public consultation link for a rendered quote.',
        10,
      ),
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
    }).pipe(documentedWrite('quote.delete', 'Cancel a quote', 'Cancels an editable quote.')),
    HttpApiEndpoint.post('publicQuoteGet', '/api/public/quote-link', {
      payload: PublicQuoteAccessRequest,
      success: PublicQuoteConsultation,
      error: [
        QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    }).pipe(internal),
    HttpApiEndpoint.post('publicQuotePdfDownload', '/api/public/quote-link/pdf', {
      payload: PublicQuoteAccessRequest,
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [
        QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    }).pipe(internal),
    HttpApiEndpoint.post('publicQuoteSign', '/api/public/quote-link/signature', {
      payload: PublicQuoteSignatureRequest,
      success: QuoteAcceptanceResult,
      error: [
        QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
        QuoteLinkNotSignable.pipe(HttpApiSchema.status(409)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    }).pipe(internal),
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
    }).pipe(
      documentedWrite(
        'quote.update',
        'Create a quote revision',
        'Creates a new revision of an editable quote.',
      ),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: 'Quotes',
      description: 'Quotes, revisions, delivery, and documents.',
    }),
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

export class InvoicesApi extends HttpApiGroup.make('invoices', { topLevel: true })
  .add(
    HttpApiEndpoint.get('invoiceList', '/api/invoices', {
      success: InvoiceList,
      error: invoiceReadErrors,
    }).pipe(
      documentedRead('invoice.read', 'List invoices', 'Lists invoices and their current state.'),
    ),
    HttpApiEndpoint.get('invoiceGet', '/api/invoices/:invoiceId', {
      params: { invoiceId: Ulid },
      success: InvoiceDetail,
      error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
    }).pipe(
      documentedRead('invoice.read', 'Get an invoice', 'Returns an invoice and its revisions.'),
    ),
    HttpApiEndpoint.get('invoicePreview', '/api/invoices/:invoiceId/revisions/:version/preview', {
      params: { invoiceId: Ulid, version: RevisionVersionParameter },
      success: Schema.String.pipe(
        HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' }),
      ),
      error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
    }).pipe(internal),
    HttpApiEndpoint.post('invoicePdfRender', '/api/invoices/:invoiceId/revisions/:version/pdf', {
      params: { invoiceId: Ulid, version: RevisionVersionParameter },
      success: InvoiceDocumentArtifact,
      error: [...invoiceWriteErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
    }).pipe(internal),
    HttpApiEndpoint.get('invoicePdfDownload', '/api/invoices/:invoiceId/revisions/:version/pdf', {
      params: { invoiceId: Ulid, version: RevisionVersionParameter },
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: 'application/pdf' }),
      ),
      error: [...invoiceReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
    }).pipe(
      documentedRead(
        'document.download',
        'Download an invoice PDF',
        'Downloads an existing invoice revision PDF.',
      ),
    ),
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
    }).pipe(
      documentedWrite(
        'invoice.create',
        'Create an invoice',
        'Creates a draft invoice from an order.',
      ),
    ),
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
    }).pipe(
      documentedWrite(
        'invoice.update',
        'Create an invoice revision',
        'Creates a new draft invoice revision.',
      ),
    ),
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
    }).pipe(
      documentedWrite(
        'invoice.issue',
        'Issue an invoice',
        'Assigns the legal invoice number and issues the invoice.',
        10,
      ),
    ),
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
    }).pipe(
      documentedWrite(
        'invoice.mark-paid',
        'Mark an invoice as paid',
        'Transitions an issued invoice to paid.',
        10,
      ),
    ),
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
    }).pipe(documentedWrite('invoice.void', 'Void an invoice', 'Voids an invoice.', 10)),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: 'Invoices',
      description: 'Invoices, revisions, lifecycle, and documents.',
    }),
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
      ],
    }),
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
    }),
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
    }),
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
  .annotateMerge(
    OpenApi.annotations({
      title: 'Froment Software Integration API',
      version: 'latest',
      description: 'API for client records, quotes, orders, invoices, and generated documents.',
    }),
  ) {}
