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
  const tokenDigest = hmac(config.quoteLinkHmacKey, token).toString('hex');
  const addressAllowed = yield* limiter.allowRequest(
    `public-quote-${route}:address:${clientAddress}`,
    limit,
  );
  const tokenAllowed = yield* limiter.allowRequest(
    `public-quote-${route}:token:${tokenDigest}`,
    limit,
  );
  if (!addressAllowed || !tokenAllowed) {
    return yield* new RequestRateLimited({ code: 'request.rate_limited' });
  }
});
