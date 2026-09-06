import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Reminders } from './reminders.js';

export const ReminderHandlers = HttpApiBuilder.group(Api, 'reminders', (handlers) =>
  Effect.gen(function* () {
    const reminders = yield* Reminders;
    return handlers
      .handle(
        'reminderList',
        Effect.fn('reminderList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* reminders.list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'reminderCreate',
        Effect.fn('reminderCreate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* reminders
            .create(params.reminderId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'reminderCancel',
        Effect.fn('reminderCancel')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* reminders
            .cancel(params.reminderId, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
);
