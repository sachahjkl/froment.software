import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/unstable/httpapi';

import { AuthenticationRequired, PermissionDenied } from '../authentication/contracts.js';
import { ClientInvoiceList, ClientOrderList, ClientQuoteList } from '../client-portal/contracts.js';
import { DocumentNotFound } from '../documents/contracts.js';
import { Ulid } from '../identifiers.js';

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
