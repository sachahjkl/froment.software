import { Api, ApiPrincipal, RequestRateLimited } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { getClientAddress } from '../http/request.js';
import { setPrivateResponseHeaders } from '../http/response.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { Team, TeamLive } from './service.js';

export const TeamHandlers = HttpApiBuilder.group(Api, 'team', (handlers) =>
  Effect.gen(function* () {
    const team = yield* Team;
    return handlers
      .handle(
        'teamList',
        Effect.fn('teamList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* team.list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'teamInvite',
        Effect.fn('teamInvite')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* team
            .invite((yield* ApiPrincipal).userId, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'teamInvitationCancel',
        Effect.fn('teamInvitationCancel')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* team
            .cancel((yield* ApiPrincipal).userId, params.invitationId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'teamMemberUpdate',
        Effect.fn('teamMemberUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          yield* team
            .update((yield* ApiPrincipal).userId, params.userId, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'teamInvitationAccept',
        Effect.fn('teamInvitationAccept')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          if (
            !(yield* (yield* RequestLimiter).allowRequest(
              `team-accept:${yield* getClientAddress()}`,
              10,
            ))
          )
            return yield* new RequestRateLimited({ code: 'request.rate_limited' });
          yield* team.accept(payload).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
).pipe(Layer.provide(TeamLive));
