import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { IssuerSettings } from './service.js';

export const IssuerSettingsHandlers = HttpApiBuilder.group(Api, 'issuerSettings', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'issuerSettingsGet',
        Effect.fn('issuerSettingsGet')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* IssuerSettings).get.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'issuerSettingsUpdate',
        Effect.fn('issuerSettingsUpdate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* IssuerSettings)
            .update(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
