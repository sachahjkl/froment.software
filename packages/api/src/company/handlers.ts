import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { Company } from './service.js';

export const CompanyHandlers = HttpApiBuilder.group(Api, 'company', (handlers) =>
  Effect.succeed(
    handlers
      .handle('companySettingsGet', () =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Company).get.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('companySettingsUpdate', ({ payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Company)
            .update(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('companyAccountingInitialize', ({ payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Company)
            .initializeAccounting(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
