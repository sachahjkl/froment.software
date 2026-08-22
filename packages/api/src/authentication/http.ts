import {
  ApiAuthentication,
  ApiAuthorization,
  ApiCredentials,
  ApiPrincipal,
  AuthenticationRequired,
  EndpointRateLimit,
  RequestRateLimited,
  RequiredPermissions,
  Ulid,
  type PermissionCodeValue,
} from '@froment/contracts';
import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { HttpApiSecurity } from 'effect/unstable/httpapi';

import { ApiTokens } from '../api-tokens/service.js';
import { getClientAddress } from '../http/request.js';
import { setPrivateResponseHeaders } from '../http/response.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { RuntimeConfiguration } from '../runtime-config.js';
import { Authentication } from './authentication.js';

export const refreshCookieName = '__Secure-froment-refresh';
export const accessCookieName = '__Secure-froment-access';
const refreshCookie = HttpApiSecurity.apiKey({ key: refreshCookieName, in: 'cookie' });
const accessCookie = HttpApiSecurity.apiKey({ key: accessCookieName, in: 'cookie' });

export const setAccessCookie = (access: {
  readonly accessToken: string;
  readonly accessExpiresAt: number;
}) =>
  HttpApiBuilder.securitySetCookie(accessCookie, access.accessToken, {
    expires: new Date(access.accessExpiresAt),
    httpOnly: true,
    secure: true,
    path: '/api',
    sameSite: 'strict',
  });

export const setRefreshCookie = (refresh: {
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
}) =>
  HttpApiBuilder.securitySetCookie(refreshCookie, refresh.refreshToken, {
    expires: refresh.refreshExpiresAt,
    httpOnly: true,
    secure: true,
    path: '/api/auth',
    sameSite: 'strict',
  });

export const clearRefreshCookie = setRefreshCookie({
  refreshToken: '',
  refreshExpiresAt: new Date(0),
});

export const clearAccessCookie = setAccessCookie({
  accessToken: '',
  accessExpiresAt: 0,
});

const accessCookieFromRequest = Effect.fn('accessCookieFromRequest')(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (request.headers['authorization'] !== undefined) return undefined;
  return request.cookies[accessCookieName];
});

export const authorizeClient = Effect.fn('authorizeClient')(function* (
  permission: PermissionCodeValue,
) {
  return yield* (yield* Authentication)
    .authorize(yield* accessCookieFromRequest(), [permission], 'client')
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
});

const ApiAuthenticationLive = Layer.succeed(
  ApiAuthentication,
  ApiAuthentication.of({
    bearer: Effect.fn('ApiAuthentication.bearer')(function* (httpEffect, { credential }) {
      yield* setPrivateResponseHeaders;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const bearerToken = Redacted.value(credential);
      const browserToken = request.cookies[accessCookieName];
      if ((bearerToken.length > 0 && browserToken !== undefined) || bearerToken.includes(',')) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      const token = browserToken ?? bearerToken;
      const kind =
        browserToken !== undefined && token.startsWith('v4.public.')
          ? ('access-token' as const)
          : browserToken === undefined && token.startsWith('froment_api_v1_')
            ? ('api-token' as const)
            : undefined;
      if (kind === undefined) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      return yield* Effect.provideService(httpEffect, ApiCredentials, {
        kind,
        token,
      });
    }),
  }),
);

const ApiAuthorizationLive = Layer.effect(
  ApiAuthorization,
  Effect.gen(function* () {
    const authentication = yield* Authentication;
    const apiTokens = yield* ApiTokens;
    const limiter = yield* RequestLimiter;
    const runtime = yield* RuntimeConfiguration;
    const limitEndpoint = Effect.fn('ApiAuthorization.limitEndpoint')(function* (
      principalId: string,
      endpointId: string,
      limit: number,
    ) {
      if (!(yield* limiter.allowRequest(`principal:${principalId}:${endpointId}`, limit))) {
        return yield* new RequestRateLimited({ code: 'request.rate_limited' });
      }
    });

    return ApiAuthorization.of(
      Effect.fn('ApiAuthorization')(function* (httpEffect, { endpoint }) {
        const credentials = yield* ApiCredentials;
        const permissions = Option.getOrThrowWith(
          Context.getOption(endpoint.annotations, RequiredPermissions),
          () => new Error('authentication.endpoint.permission_missing'),
        );
        const endpointRateLimit = Context.getOption(endpoint.annotations, EndpointRateLimit);

        if (credentials.kind === 'access-token') {
          const principal = yield* authentication
            .authorize(credentials.token, permissions, 'administrator')
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          if (Option.isSome(endpointRateLimit)) {
            yield* limitEndpoint(principal.userId, endpoint.identifier, endpointRateLimit.value);
          }
          return yield* Effect.provideService(httpEffect, ApiPrincipal, {
            userId: Schema.decodeUnknownSync(Ulid)(principal.userId),
            credential: {
              kind: 'access-token',
              sessionId: Schema.decodeUnknownSync(Ulid)(principal.sessionId),
            },
          });
        }

        if (
          !(yield* limiter.allowRequest(
            `api-token-auth:address:${yield* getClientAddress()}`,
            runtime.authentication.apiTokenAttemptsPerAddressPerMinute,
          ))
        ) {
          return yield* new RequestRateLimited({ code: 'request.rate_limited' });
        }
        const principal = yield* apiTokens
          .authenticate(credentials.token)
          .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        if (
          !(yield* limiter.allowRequest(
            `api-token:${principal.tokenId}:all`,
            principal.rateLimitPerMinute,
          ))
        ) {
          return yield* new RequestRateLimited({ code: 'request.rate_limited' });
        }
        for (const permission of permissions) {
          yield* apiTokens
            .authorizePermission(principal, permission)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }
        if (Option.isSome(endpointRateLimit)) {
          yield* limitEndpoint(principal.tokenId, endpoint.identifier, endpointRateLimit.value);
        }
        return yield* Effect.provideService(httpEffect, ApiPrincipal, {
          userId: principal.userId,
          credential: { kind: 'api-token', tokenId: principal.tokenId },
        });
      }),
    );
  }),
);

export const AuthenticationHttpLive = Layer.mergeAll(ApiAuthenticationLive, ApiAuthorizationLive);
