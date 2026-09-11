import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import { Ulid } from '../identifiers.js';
import { AuthenticationRequired, PermissionDenied } from '../authentication/contracts.js';
import {
  CreditNoteRequest,
  InvoiceCreditConflict,
  InvoiceCreditRequestConflict,
  InvoiceCredits,
  InvoiceRefundRequest,
  InvoiceRefundCancel,
} from './credit-notes.js';

export class CreditNotesApi extends HttpApiGroup.make('creditNotes', { topLevel: true }).add(
  HttpApiEndpoint.get('invoiceCreditsGet', '/api/invoices/:invoiceId/credits', {
    params: { invoiceId: Ulid },
    success: InvoiceCredits,
    error: [InvoiceCreditConflict],
  }).pipe(requirePermissions([Permissions.invoiceRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('invoiceCreditIssue', '/api/invoices/:invoiceId/credits', {
    params: { invoiceId: Ulid },
    payload: CreditNoteRequest,
    success: InvoiceCredits,
    error: [InvoiceCreditConflict, InvoiceCreditRequestConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.invoiceCredit]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('invoiceRefundRecord', '/api/invoices/:invoiceId/refunds', {
    params: { invoiceId: Ulid },
    payload: InvoiceRefundRequest,
    success: InvoiceCredits,
    error: [InvoiceCreditConflict, InvoiceCreditRequestConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.invoiceRefund]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('invoiceRefundCancel', '/api/invoices/:invoiceId/refunds/:refundId/cancel', {
    params: { invoiceId: Ulid, refundId: Ulid },
    payload: InvoiceRefundCancel,
    success: InvoiceCredits,
    error: [InvoiceCreditConflict, InvoiceCreditRequestConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.invoiceRefund]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('invoiceCreditPdf', '/api/invoices/:invoiceId/credit-note/pdf', {
    params: { invoiceId: Ulid },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [InvoiceCreditConflict],
  }).pipe(
    requirePermissions([Permissions.documentDownload, Permissions.invoiceRead]),
    authenticate,
    frontendSpecific,
  ),
  HttpApiEndpoint.get('clientCreditPdf', '/api/client/invoices/:invoiceId/credit-note/pdf', {
    params: { invoiceId: Ulid },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [InvoiceCreditConflict, AuthenticationRequired, PermissionDenied],
  }).pipe(frontendSpecific),
) {}
