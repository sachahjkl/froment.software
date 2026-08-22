import { Api } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { Database } from '../database/database.js';
import { Deployment } from '../deployment/deployment.js';
import { setPrivateResponseHeaders } from '../http/response.js';

export const StatusHandlers = HttpApiBuilder.group(Api, 'status', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'health',
        Effect.fn('health')(function* () {
          const database = yield* Database;
          yield* Effect.sync(() => database.sqlite.prepare('select 1').get());
          return { status: 'ok' as const };
        }),
      )
      .handle(
        'version',
        Effect.fn('version')(function* () {
          yield* setPrivateResponseHeaders;
          return (yield* Deployment).metadata;
        }),
      ),
  ),
);
