import { RequestRateLimited } from '@froment/contracts';
import { Effect } from 'effect';

import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { RuntimeConfiguration } from '../runtime-config.js';

export const limitPublicQuoteRequest = Effect.fn('limitPublicQuoteRequest')(function* (
  route: 'read' | 'download' | 'signature',
  token: string,
  clientAddress: string,
) {
  const limiter = yield* RequestLimiter;
  const config = yield* AuthenticationConfig;
  const runtime = yield* RuntimeConfiguration;
  const limit =
    route === 'read'
      ? runtime.publicQuote.readPerMinute
      : route === 'download'
        ? runtime.publicQuote.downloadPerMinute
        : runtime.publicQuote.signaturePerMinute;
  const addressAllowed = yield* limiter.allowPublicRequest(
    `public-quote-${route}:address:${clientAddress}`,
    limit,
  );
  if (!addressAllowed) {
    return yield* new RequestRateLimited({ code: 'request.rate_limited' });
  }
  const tokenDigest = hmac(config.quoteLinkHmacKey, token).toString('hex');
  const tokenAllowed = yield* limiter.allowPublicRequest(
    `public-quote-${route}:token:${tokenDigest}`,
    limit,
  );
  if (!tokenAllowed) {
    return yield* new RequestRateLimited({ code: 'request.rate_limited' });
  }
});
