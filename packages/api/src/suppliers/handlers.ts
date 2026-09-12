import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { Suppliers } from './service.js';

export const SupplierHandlers = HttpApiBuilder.group(Api, 'suppliers', (handlers) =>
  Effect.succeed(
    handlers
      .handle('supplierList', () =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Suppliers).list.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('supplierGet', ({ params }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Suppliers)
            .get(params.supplierId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierCreate', ({ payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Suppliers)
            .create(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierUpdate', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Suppliers)
            .update(params.supplierId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierArchive', ({ params }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Suppliers)
            .archive(params.supplierId, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('supplierReactivate', ({ params }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Suppliers)
            .reactivate(params.supplierId, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
