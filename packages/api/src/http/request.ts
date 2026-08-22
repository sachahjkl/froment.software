import { Context, Effect, Option, Schema } from 'effect';
import { isIP } from 'node:net';
import { HttpServerRequest } from 'effect/unstable/http';

export const IpAddress = Schema.String.check(
  Schema.makeFilter((value) => isIP(value) !== 0, { identifier: 'IpAddress' }),
);

export class TrustedProxyAddresses extends Context.Reference<ReadonlySet<string>>(
  '@froment/api/TrustedProxyAddresses',
  { defaultValue: () => new Set() },
) {}

export const resolveClientAddress = (
  directAddress: string,
  realAddress: string | undefined,
  trustedProxyAddresses: ReadonlySet<string>,
): string => {
  if (!trustedProxyAddresses.has(directAddress)) return directAddress;
  const candidate = realAddress?.trim();
  return candidate !== undefined && isIP(candidate) !== 0 ? candidate : directAddress;
};

export const getClientAddress = Effect.fn('getClientAddress')(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const directAddress = Option.getOrElse(request.remoteAddress, () => 'unknown').slice(0, 64);
  const trustedProxyAddresses = yield* TrustedProxyAddresses;
  return resolveClientAddress(directAddress, request.headers['x-real-ip'], trustedProxyAddresses);
});
