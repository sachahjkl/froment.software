import { Api } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { Audit } from '../audit/audit.js';
import { setPrivateResponseHeaders } from '../http/response.js';

export const AffairHandlers = HttpApiBuilder.group(Api, 'affairs', (handlers) =>
  Effect.succeed(
    handlers.handle(
      'affairEventList',
      Effect.fn('affairEventList')(function* ({ params }) {
        yield* setPrivateResponseHeaders;
        return yield* (yield* Audit)
          .listAffair(params.quoteId)
          .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
      }),
    ),
  ),
);
