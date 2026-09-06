import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { EmailDrafts, EmailDraftsLive } from './email-drafts.js';

export const EmailDraftHandlers = HttpApiBuilder.group(Api, 'emailDrafts', (handlers) =>
  Effect.gen(function* () {
    const drafts = yield* EmailDrafts;
    return handlers
      .handle(
        'emailDraftList',
        Effect.fn('emailDraftList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* drafts
            .list((yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'emailDraftSave',
        Effect.fn('emailDraftSave')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* drafts
            .save((yield* ApiPrincipal).userId, params.draftId, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'emailDraftArchive',
        Effect.fn('emailDraftArchive')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          yield* drafts
            .archive((yield* ApiPrincipal).userId, params.draftId, payload.expectedVersion)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
).pipe(Layer.provide(EmailDraftsLive));
