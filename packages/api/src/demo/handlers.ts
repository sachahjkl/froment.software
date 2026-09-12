import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Demo } from './service.js';

export const DemoHandlers = HttpApiBuilder.group(Api, 'demo', (handlers) =>
  Effect.succeed(
    handlers.handle('demoReset', ({ payload }) =>
      Effect.gen(function* () {
        yield* setPrivateResponseHeaders;
        const principal = yield* ApiPrincipal;
        return yield* (yield* Demo)
          .reset(payload, principal.userId)
          .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
      }),
    ),
  ),
);
