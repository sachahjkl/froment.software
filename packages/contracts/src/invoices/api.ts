import { Schema } from 'effect';
import { InvoicePaymentRequest, InvoicePaymentInvalid } from './payments.js';
import {
  PaymentExportQuery,
  PaymentExportInvalidRange,
  PaymentExportTooLarge,
} from './payment-export.js';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { RevisionVersionParameter } from '../api-common.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { DocumentIncomplete, DocumentNotFound } from '../documents/contracts.js';
import { Ulid } from '../identifiers.js';
import {
  CalendarDateText,
  InvoiceAlreadyExists,
  InvoiceAmountTooLarge,
  InvoiceCreateRequest,
  InvoiceDetail,
  InvoiceDocumentArtifact,
  InvoiceInvalidDates,
  InvoiceInvalidTransition,
  InvoiceExchangeRateMissing,
  InvoiceAccountingUnavailable,
  InvoiceIssueRequest,
  InvoiceIssueResult,
  InvoiceList,
  InvoiceNotEditable,
  InvoiceNotFound,
  InvoiceOrderNotFound,
  InvoiceRevisionCreateRequest,
  InvoiceTransitionRequest,
  InvoiceVersionConflict,
} from '../invoices/contracts.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import {
  InvoiceReceiptList,
  CreditNoteList,
  InvoiceRefundList,
  InvoiceHistory,
  InvoiceWorkspaceLimitExceeded,
} from './workspace.js';

const invoiceReadErrors = [
  AuthenticationRequired.pipe(HttpApiSchema.status(401)),
  PermissionDenied.pipe(HttpApiSchema.status(403)),
];
const invoiceWriteErrors = [
  ...invoiceReadErrors,
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
  HttpApiEndpoint.get('invoiceReceiptList', '/api/invoice-payments', {
    success: InvoiceReceiptList,
    error: [...invoiceReadErrors, InvoiceWorkspaceLimitExceeded],
  }).pipe(requirePermissions([Permissions.paymentRead, Permissions.invoiceRead]), authenticate),
  HttpApiEndpoint.get('creditNoteList', '/api/credit-notes', {
    success: CreditNoteList,
    error: [...invoiceReadErrors, InvoiceWorkspaceLimitExceeded],
  }).pipe(requirePermissions([Permissions.invoiceRead]), authenticate),
  HttpApiEndpoint.get('invoiceRefundList', '/api/invoice-refunds', {
    success: InvoiceRefundList,
    error: [...invoiceReadErrors, InvoiceWorkspaceLimitExceeded],
  }).pipe(requirePermissions([Permissions.paymentRead, Permissions.invoiceRead]), authenticate),
  HttpApiEndpoint.get('invoiceHistory', '/api/invoices/:invoiceId/history', {
    params: { invoiceId: Ulid },
    success: InvoiceHistory,
    error: [...invoiceReadErrors, InvoiceNotFound, InvoiceWorkspaceLimitExceeded],
  }).pipe(
    requirePermissions([Permissions.invoiceRead, Permissions.auditRead]),
    authenticate,
    frontendSpecific,
  ),
  HttpApiEndpoint.get('invoicePaymentExport', '/api/invoice-payments/export', {
    query: PaymentExportQuery,
    success: Schema.Uint8Array.pipe(
      HttpApiSchema.asUint8Array({ contentType: 'text/csv; charset=utf-8' }),
    ),
    error: [...invoiceWriteErrors, PaymentExportInvalidRange, PaymentExportTooLarge],
  }).pipe(
    requirePermissions([Permissions.paymentRead]),
    authenticate,
    rateLimit(RateLimits.tenPerMinute),
  ),
  HttpApiEndpoint.get('invoiceList', '/api/invoices', {
    success: InvoiceList,
    error: invoiceReadErrors,
  }).pipe(requirePermissions([Permissions.invoiceRead]), authenticate),
  HttpApiEndpoint.get('invoiceGet', '/api/invoices/:invoiceId', {
    params: { invoiceId: Ulid },
    success: InvoiceDetail,
    error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.invoiceRead]), authenticate),
  HttpApiEndpoint.get('invoicePreview', '/api/invoices/:invoiceId/revisions/:version/preview', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [...invoiceReadErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.documentRender]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('invoicePdfRender', '/api/invoices/:invoiceId/revisions/:version/pdf', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: InvoiceDocumentArtifact,
    error: [...invoiceWriteErrors, InvoiceNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(
    requirePermissions([Permissions.documentRender]),
    authenticate,
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
  HttpApiEndpoint.get('invoicePdfDownload', '/api/invoices/:invoiceId/revisions/:version/pdf', {
    params: { invoiceId: Ulid, version: RevisionVersionParameter },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [...invoiceReadErrors, DocumentNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.documentDownload]), authenticate),
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
    .pipe(
      requirePermissions([Permissions.invoiceCreate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
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
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.invoiceUpdate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
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
      InvoiceExchangeRateMissing.pipe(HttpApiSchema.status(422)),
      InvoiceAccountingUnavailable.pipe(HttpApiSchema.status(422)),
      DocumentIncomplete.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.invoiceIssue]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
    ),
  HttpApiEndpoint.post('invoicePaymentCreate', '/api/invoices/:invoiceId/payments', {
    params: { invoiceId: Ulid },
    payload: Schema.Struct({ ...InvoicePaymentRequest.fields, paidOn: CalendarDateText }),
    success: InvoiceDetail,
    error: [
      InvoicePaymentInvalid,
      ...invoiceWriteErrors,
      InvoiceNotFound.pipe(HttpApiSchema.status(404)),
      InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
      InvoiceInvalidTransition.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.invoiceMarkPaid]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
    ),
  HttpApiEndpoint.post(
    'invoicePaymentCancel',
    '/api/invoices/:invoiceId/payments/:paymentId/cancel',
    {
      params: { invoiceId: Ulid, paymentId: Ulid },
      payload: InvoicePaymentCancelRequest,
      success: InvoiceDetail,
      error: [
        InvoicePaymentInvalid,
        ...invoiceWriteErrors,
        InvoiceNotFound.pipe(HttpApiSchema.status(404)),
        InvoiceVersionConflict.pipe(HttpApiSchema.status(409)),
        InvoiceInvalidTransition.pipe(HttpApiSchema.status(409)),
      ],
    },
  )
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.invoiceMarkPaid]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
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
      InvoiceAccountingUnavailable.pipe(HttpApiSchema.status(422)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.invoiceVoid]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
    ),
) {}
import { InvoicePaymentCancelRequest } from './payments.js';
