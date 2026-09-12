import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { Roles, RolesLive } from './service.js';

export const RoleHandlers = HttpApiBuilder.group(Api, 'roles', (handlers) =>
  Effect.gen(function* () {
    const roles = yield* Roles;
    return handlers
      .handle('customRoleList', () =>
        setPrivateResponseHeaders.pipe(
          Effect.andThen(roles.list),
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('customRoleGet', ({ params }) =>
        setPrivateResponseHeaders.pipe(
          Effect.andThen(roles.get(params.roleId)),
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('customRoleCreate', ({ payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* roles
            .create(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('customRoleUpdate', ({ params, payload }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          return yield* roles
            .update(params.roleId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('customRoleDelete', ({ params }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          yield* roles
            .remove(params.roleId, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      );
  }),
).pipe(Layer.provide(RolesLive));
