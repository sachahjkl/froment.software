import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { QuoteConditionPresets } from './service.js';

export const QuoteConditionPresetHandlers = HttpApiBuilder.group(
  Api,
  'quoteConditionPresets',
  (handlers) =>
    Effect.succeed(
      handlers
        .handle(
          'quoteConditionPresetList',
          Effect.fn('quoteConditionPresetList')(function* () {
            yield* setPrivateResponseHeaders;
            return yield* (yield* QuoteConditionPresets).list.pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
            );
          }),
        )
        .handle(
          'quoteConditionPresetCreate',
          Effect.fn('quoteConditionPresetCreate')(function* ({ payload }) {
            yield* setPrivateResponseHeaders;
            const principal = yield* ApiPrincipal;
            return yield* (yield* QuoteConditionPresets)
              .create(payload, principal.userId)
              .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          }),
        )
        .handle(
          'quoteConditionPresetUpdate',
          Effect.fn('quoteConditionPresetUpdate')(function* ({ params, payload }) {
            yield* setPrivateResponseHeaders;
            const principal = yield* ApiPrincipal;
            return yield* (yield* QuoteConditionPresets)
              .update(params.presetId, payload, principal.userId)
              .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          }),
        )
        .handle(
          'quoteConditionPresetDelete',
          Effect.fn('quoteConditionPresetDelete')(function* ({ params }) {
            yield* setPrivateResponseHeaders;
            const principal = yield* ApiPrincipal;
            return yield* (yield* QuoteConditionPresets)
              .remove(params.presetId, principal.userId)
              .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          }),
        ),
    ),
);
