import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { authorizeClient } from '../authentication/http.js';
import { Clients } from '../clients/clients.js';
import { setPrivateResponseHeaders, setPdfResponseHeaders } from '../http/response.js';
import { InvoiceCreditNotes, InvoiceCreditNotesLive } from './credits.js';

const pdfFilename = (number: string) =>
  HttpEffect.appendPreResponseHandler((_request, response) =>
    Effect.succeed(
      HttpServerResponse.setHeader(
        response,
        'content-disposition',
        `attachment; filename="${number}.pdf"`,
      ),
    ),
  );
export const CreditNoteHandlers = HttpApiBuilder.group(Api, 'creditNotes', (handlers) =>
  Effect.gen(function* () {
    const credits = yield* InvoiceCreditNotes;
    return handlers
      .handle(
        'invoiceCreditsGet',
        Effect.fn('invoiceCreditsGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .get(params.invoiceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'creditNoteGet',
        Effect.fn('creditNoteGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .getNote(params.creditNoteId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'creditNoteCreate',
        Effect.fn('creditNoteCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .create(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'creditNoteUpdate',
        Effect.fn('creditNoteUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .update(params.creditNoteId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'creditNoteIssue',
        Effect.fn('creditNoteIssue')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .issue(params.creditNoteId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceRefundRecord',
        Effect.fn('invoiceRefundRecord')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .refund(params.invoiceId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceCreditAllocate',
        Effect.fn('invoiceCreditAllocate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .allocate(params.invoiceId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceRefundCancel',
        Effect.fn('invoiceRefundCancel')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .cancelRefund(params.invoiceId, params.refundId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceCreditAllocationCancel',
        Effect.fn('invoiceCreditAllocationCancel')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* credits
            .cancelAllocation(
              params.invoiceId,
              params.allocationId,
              payload,
              (yield* ApiPrincipal).userId,
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceCreditPdf',
        Effect.fn('invoiceCreditPdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const pdf = yield* credits
            .pdf(params.creditNoteId)
            .pipe(Effect.catchTag(['DatabaseError', 'DocumentRenderError'], Effect.die));
          yield* pdfFilename(pdf.number);
          return pdf.content;
        }),
      )
      .handle(
        'clientCreditPdf',
        Effect.fn('clientCreditPdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const pdf = yield* credits
            .clientPdf(params.creditNoteId, clientId)
            .pipe(Effect.catchTag(['DatabaseError', 'DocumentRenderError'], Effect.die));
          yield* pdfFilename(pdf.number);
          return pdf.content;
        }),
      );
  }),
).pipe(Layer.provide(InvoiceCreditNotesLive));
