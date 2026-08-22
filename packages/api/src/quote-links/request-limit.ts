import { RequestRateLimited } from '@froment/contracts';
import { Effect } from 'effect';

import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { RequestLimiter } from '../server/request-limiter.js';

export const PublicQuoteRateLimits = {
  readPerMinute: 60,
  downloadPerMinute: 20,
  signaturePerMinute: 10,
} as const;

export const limitPublicQuoteRequest = Effect.fn('limitPublicQuoteRequest')(function* (
  route: 'read' | 'download' | 'signature',
  token: string,
  clientAddress: string,
  limit: number,
) {
  const limiter = yield* RequestLimiter;
  const config = yield* AuthenticationConfig;
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
