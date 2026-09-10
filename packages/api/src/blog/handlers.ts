import { Api } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { blogFeed } from './feed.js';

export const blogHandlers = (publicOrigin: string) =>
  HttpApiBuilder.group(Api, 'blog', (handlers) =>
    handlers.handle(
      'blogFeed',
      Effect.fn('blogFeed')(function* () {
        yield* HttpEffect.appendPreResponseHandler((_request, response) =>
          Effect.succeed(
            HttpServerResponse.setHeaders(response, {
              'content-language': 'fr',
              'cache-control': 'no-cache',
              'x-content-type-options': 'nosniff',
            }),
          ),
        );
        return blogFeed(publicOrigin);
      }),
    ),
  );
