import { Api } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setSessionCookies } from '../authentication/http.js';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Bootstrap } from './bootstrap.js';

export const BootstrapHandlers = HttpApiBuilder.group(Api, 'bootstrap', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'bootstrapStatus',
        Effect.fn('bootstrapStatus')(function* () {
          yield* setPrivateResponseHeaders;
          const bootstrap = yield* Bootstrap;
          return { available: yield* bootstrap.isAvailable.pipe(Effect.orDie) };
        }),
      )
      .handle(
        'bootstrapCreate',
        Effect.fn('bootstrapCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const session = yield* (yield* Bootstrap)
            .create(payload.password)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setSessionCookies(session);
          return { accessIdentifier: session.accessIdentifier };
        }),
      ),
  ),
);
