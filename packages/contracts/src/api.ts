import { Schema } from 'effect';
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

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
} from './clients.js';
import { Ulid } from './identifiers.js';
import {
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
  InvoiceAlreadyExists,
  InvoiceAmountTooLarge,
  InvoiceCreateRequest,
  InvoiceDetail,
  InvoiceDocumentArtifact,
  InvoiceInvalidDates,
  InvoiceIssueRequest,
  InvoiceIssueResult,
  InvoiceList,
  InvoiceNotEditable,
  InvoiceNotFound,
  InvoiceOrderNotFound,
  InvoiceRevisionCreateRequest,
  InvoiceVersionConflict,
} from './invoices.js';

const RevisionVersionParameter = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isGreaterThan(0),
);

export class SystemApi extends HttpApiGroup.make('system', { topLevel: true }).add(
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
) {}

export class ClientsApi extends HttpApiGroup.make('clients', { topLevel: true }).add(
  HttpApiEndpoint.get('clientList', '/api/clients', {
    success: ClientList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }),
  HttpApiEndpoint.post('clientCreate', '/api/clients', {
    payload: ClientCreateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
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
  }),
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
  }),
) {}

export class QuotesApi extends HttpApiGroup.make('quotes', { topLevel: true }).add(
  HttpApiEndpoint.get('issuerSettingsGet', '/api/issuer-settings', {
    success: IssuerSettings,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }),
  HttpApiEndpoint.put('issuerSettingsUpdate', '/api/issuer-settings', {
    payload: IssuerSettingsUpdateRequest,
    success: IssuerSettings,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.get('quoteList', '/api/quotes', {
    success: QuoteList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }),
  HttpApiEndpoint.get('quoteGet', '/api/quotes/:quoteId', {
    params: { quoteId: Ulid },
    success: QuoteDetail,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }),
  HttpApiEndpoint.get('quotePreview', '/api/quotes/:quoteId/revisions/:version/preview', {
    params: { quoteId: Ulid, version: RevisionVersionParameter },
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      QuoteNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }),
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
  }),
  HttpApiEndpoint.get('quotePdfDownload', '/api/quotes/:quoteId/revisions/:version/pdf', {
    params: { quoteId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      DocumentNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }),
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
  }),
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
  }),
  HttpApiEndpoint.post('publicQuoteGet', '/api/public/quote-link', {
    payload: PublicQuoteAccessRequest,
    success: PublicQuoteConsultation,
    error: QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
  }),
  HttpApiEndpoint.post('publicQuotePdfDownload', '/api/public/quote-link/pdf', {
    payload: PublicQuoteAccessRequest,
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
  }),
  HttpApiEndpoint.post('publicQuoteSign', '/api/public/quote-link/signature', {
    payload: PublicQuoteSignatureRequest,
    success: QuoteAcceptanceResult,
    error: [
      QuoteLinkNotFound.pipe(HttpApiSchema.status(404)),
      QuoteLinkNotSignable.pipe(HttpApiSchema.status(409)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
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

export class InvoicesApi extends HttpApiGroup.make('invoices', { topLevel: true }).add(
  HttpApiEndpoint.get('invoiceList', '/api/invoices', {
    success: InvoiceList,
    error: invoiceReadErrors,
  }),
  HttpApiEndpoint.get('invoiceGet', '/api/invoices/:invoiceId', {
    params: { invoiceId: Ulid },
    success: InvoiceDetail,
    error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }),
  HttpApiEndpoint.get('invoicePreview', '/api/invoices/:invoiceId/revisions/:version/preview', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' })),
    error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }),
  HttpApiEndpoint.post('invoicePdfRender', '/api/invoices/:invoiceId/revisions/:version/pdf', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: InvoiceDocumentArtifact,
    error: [...invoiceWriteErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }),
  HttpApiEndpoint.get('invoicePdfDownload', '/api/invoices/:invoiceId/revisions/:version/pdf', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [...invoiceReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
  }),
  HttpApiEndpoint.post('invoiceCreate', '/api/invoices', {
    payload: InvoiceCreateRequest,
    success: InvoiceDetail,
    error: [
      ...invoiceWriteErrors,
      InvoiceOrderNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceAlreadyExists.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidDates.pipe(HttpApiSchema.status(422)),
      InvoiceAmountTooLarge.pipe(HttpApiSchema.status(422)),
    ],
  }),
  HttpApiEndpoint.post('invoiceRevisionCreate', '/api/invoices/:invoiceId/revisions', {
    params: { invoiceId: Ulid },
    payload: InvoiceRevisionCreateRequest,
    success: InvoiceDetail,
    error: [
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceNotEditable.pipe(HttpApiSchema.status(409)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidDates.pipe(HttpApiSchema.status(422)),
      InvoiceAmountTooLarge.pipe(HttpApiSchema.status(422)),
    ],
  }),
  HttpApiEndpoint.post('invoiceIssue', '/api/invoices/:invoiceId/issue', {
    params: { invoiceId: Ulid },
    payload: InvoiceIssueRequest,
    success: InvoiceIssueResult,
    error: [
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidDates.pipe(HttpApiSchema.status(422)),
    ],
  }),
) {}

export class Api extends HttpApi.make('froment-api')
  .add(SystemApi)
  .add(ClientsApi)
  .add(QuotesApi)
  .add(InvoicesApi) {}
