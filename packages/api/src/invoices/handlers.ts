import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { DocumentArtifacts } from '../documents/document-artifacts.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import {
  setPdfPreviewFilename,
  setPdfResponseHeaders,
  setPrivateResponseHeaders,
} from '../http/response.js';
import { Invoices } from './invoices.js';
import { issueInvoice } from './issue.js';
import { exportInvoicePayments } from './payment-export.js';

export const InvoiceHandlers = HttpApiBuilder.group(Api, 'invoices', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'invoicePaymentCancel',
        Effect.fn('invoicePaymentCancel')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Invoices)
            .cancelPayment(params.invoiceId, params.paymentId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoicePaymentExport',
        Effect.fn('invoicePaymentExport')(function* ({ query }) {
          yield* setPrivateResponseHeaders;
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                'attachment; filename="invoice-payments.csv"',
              ),
            ),
          );
          return yield* exportInvoicePayments(query).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'invoiceList',
        Effect.fn('invoiceList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Invoices).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceGet',
        Effect.fn('invoiceGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Invoices)
            .get(params.invoiceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoicePreview',
        Effect.fn('invoicePreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const snapshot = yield* (yield* Invoices)
            .getSnapshot(params.invoiceId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setPdfPreviewFilename(
            `preview-facture-${snapshot.invoiceNumber ?? snapshot.invoiceId}-v${snapshot.version}.pdf`,
          );
          return yield* (yield* DocumentRenderer)
            .renderInvoicePdf(snapshot, { preview: true })
            .pipe(Effect.orDie);
        }),
      )
      .handle(
        'invoicePdfRender',
        Effect.fn('invoicePdfRender')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* DocumentArtifacts)
            .renderInvoicePdf(params.invoiceId, params.version, principal.userId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('DocumentRenderError', Effect.orDie),
            );
        }),
      )
      .handle(
        'invoicePdfDownload',
        Effect.fn('invoicePdfDownload')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const invoice = yield* (yield* Invoices)
            .get(params.invoiceId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('InvoiceNotFound', Effect.orDie),
            );
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${invoice.invoiceNumber ?? params.invoiceId}-v${params.version}.pdf"`,
              ),
            ),
          );
          return yield* (yield* DocumentArtifacts)
            .getInvoicePdf(params.invoiceId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceCreate',
        Effect.fn('invoiceCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Invoices)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceRevisionCreate',
        Effect.fn('invoiceRevisionCreate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Invoices)
            .createRevision(params.invoiceId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceIssue',
        Effect.fn('invoiceIssue')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* issueInvoice(params.invoiceId, payload, principal.userId);
        }),
      )
      .handle(
        'invoicePaymentCreate',
        Effect.fn('invoicePaymentCreate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Invoices)
            .recordPayment(params.invoiceId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceVoid',
        Effect.fn('invoiceVoid')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Invoices)
            .voidInvoice(params.invoiceId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
