import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { SupplierInvoices } from './service.js';

export const SupplierInvoiceHandlers = HttpApiBuilder.group(Api, 'supplierInvoices', (handlers) =>
  Effect.gen(function* () {
    const invoices = yield* SupplierInvoices;
    const principal = () => Effect.map(ApiPrincipal, ({ userId }) => userId);
    return handlers
      .handle('supplierInvoiceList', () =>
        setPrivateResponseHeaders.pipe(
          Effect.andThen(invoices.list),
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('supplierInvoiceGet', ({ params }) =>
        setPrivateResponseHeaders.pipe(
          Effect.andThen(invoices.get(params.invoiceId)),
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('supplierInvoiceCreate', ({ payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* invoices
            .create(payload, yield* principal())
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierInvoiceUpdate', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* invoices
            .update(params.invoiceId, payload, yield* principal())
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierInvoiceConfirm', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* invoices
            .transition(
              params.invoiceId,
              payload.expectedVersion,
              ['draft'],
              'confirmed',
              yield* principal(),
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierInvoiceApprove', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* invoices
            .transition(
              params.invoiceId,
              payload.expectedVersion,
              ['confirmed'],
              'approved',
              yield* principal(),
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierInvoiceCancel', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* invoices
            .transition(
              params.invoiceId,
              payload.expectedVersion,
              ['draft', 'confirmed'],
              'cancelled',
              yield* principal(),
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
);
