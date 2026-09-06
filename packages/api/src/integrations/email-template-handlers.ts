import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { EmailTemplates, EmailTemplatesLive } from './email-templates.js';

export const EmailTemplateHandlers = HttpApiBuilder.group(Api, 'emailTemplates', (handlers) =>
  Effect.gen(function* () {
    const templates = yield* EmailTemplates;
    return handlers
      .handle(
        'emailTemplateList',
        Effect.fn('emailTemplateList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* templates.list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'emailTemplateSave',
        Effect.fn('emailTemplateSave')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* templates
            .save((yield* ApiPrincipal).userId, params.templateId, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'emailTemplateArchive',
        Effect.fn('emailTemplateArchive')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          yield* templates
            .archive((yield* ApiPrincipal).userId, params.templateId, payload.expectedVersion)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
).pipe(Layer.provide(EmailTemplatesLive));
