import { Schema } from 'effect';
import { InvoicePaymentRequest, InvoicePaymentInvalid } from './payments.js';
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
    .pipe(
      requirePermissions([Permissions.invoiceVoid]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
    ),
) {}
