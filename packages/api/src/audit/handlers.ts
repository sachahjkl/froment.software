import { Api, AuditUnavailable, InvalidAuditQuery } from '@froment/contracts';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { RuntimeConfiguration } from '../runtime-config.js';
import { auditQuerySchema } from './query.js';
import { AuditReader } from './reader.js';

export const AuditHandlers = HttpApiBuilder.group(Api, 'audit', (handlers) =>
  Effect.gen(function* () {
    const reader = yield* AuditReader;
    const decodeQuery = Schema.decodeUnknownEffect(
      auditQuerySchema((yield* RuntimeConfiguration).audit.pageSize),
    );
    return handlers.handle(
      'auditEventList',
      Effect.fn('auditEventList')(function* ({ query }) {
        yield* setPrivateResponseHeaders;
        const validated = yield* decodeQuery(query).pipe(
          Effect.mapError(() => new InvalidAuditQuery({ code: 'audit.invalid_query' })),
        );
        return yield* reader
          .list(validated)
          .pipe(
            Effect.catchTag('DatabaseError', () =>
              Effect.fail(new AuditUnavailable({ code: 'audit.unavailable' })),
            ),
          );
      }),
    );
  }),
);
