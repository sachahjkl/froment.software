import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { Audit } from '../audit/audit.js';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Affairs, AffairsLive } from './service.js';

export const AffairHandlers = HttpApiBuilder.group(Api, 'affairs', (handlers) =>
  Effect.gen(function* () {
    const affairs = yield* Affairs;
    return handlers
      .handle(
        'affairList',
        Effect.fn('affairList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* affairs.list().pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'affairGet',
        Effect.fn('affairGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* affairs
            .get(params.affairId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'affairCreate',
        Effect.fn('affairCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* affairs
            .create(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'affairUpdate',
        Effect.fn('affairUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* affairs
            .update(params.affairId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'affairEventList',
        Effect.fn('affairEventList')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Audit)
            .listAffair(params.affairId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
).pipe(Layer.provide(AffairsLive));
