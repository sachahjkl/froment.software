import {
  ApiAuthentication,
  ApiAuthorization,
  ApiBrowserRequest,
  ApiCredentials,
  ApiPrincipal,
  ApiRequestBody,
  AuthenticationRequired,
  EndpointRateLimit,
  RequestInvalidOrigin,
  RequestRateLimited,
  RequestTooLarge,
  RequiredPermissions,
  Ulid,
  type PermissionCodeValue,
} from '@froment/contracts';
import { Context, Effect, FileSystem, Layer, Option, Redacted, Schema } from 'effect';
import { HttpMethod, HttpServerError, HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder, HttpApiSecurity } from 'effect/unstable/httpapi';

import { IntegrationTokens } from '../integration-tokens/service.js';
import { getClientAddress } from '../http/request.js';
import { setPrivateResponseHeaders } from '../http/response.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { Authentication } from './authentication.js';
import { AuthenticationConfig } from './authentication-config.js';

export const sessionCookieName = '__Host-froment-session';
export const csrfCookieName = '__Host-froment-csrf';
export const csrfHeaderName = 'x-csrf-token';

export const RequestBodyLimits = {
  thirtyTwoKiB: FileSystem.Size(32 * 1024),
} as const;

const AuthenticationRateLimits = {
  integrationAttemptsPerAddressPerMinute: 120,
} as const;

const sessionCookie = HttpApiSecurity.apiKey({
  key: sessionCookieName,
  in: 'cookie',
});
const csrfCookie = HttpApiSecurity.apiKey({
  key: csrfCookieName,
  in: 'cookie',
});

export const setSessionCookies = (session: {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}) =>
  Effect.gen(function* () {
    const cookieOptions = {
      expires: session.expiresAt,
      path: '/',
      sameSite: 'strict' as const,
    };
    yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.sessionToken, cookieOptions);
    yield* HttpApiBuilder.securitySetCookie(csrfCookie, session.csrfToken, {
      ...cookieOptions,
      httpOnly: false,
    });
  });

export const authorizeClient = Effect.fn('authorizeClient')(function* (
  permission: PermissionCodeValue,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* (yield* Authentication)
    .authorize(request.cookies[sessionCookieName], [permission], 'client')
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
});

const ApiAuthenticationLive = Layer.succeed(
  ApiAuthentication,
  ApiAuthentication.of({
    sessionCookie: Effect.fn('ApiAuthentication.sessionCookie')(function* (
      httpEffect,
      { credential },
    ) {
      yield* setPrivateResponseHeaders;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const sessionToken = Redacted.value(credential);
      if (sessionToken.length === 0 || request.headers['authorization'] !== undefined) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      return yield* Effect.provideService(httpEffect, ApiCredentials, {
        kind: 'session',
        token: sessionToken,
      });
    }),
    bearer: Effect.fn('ApiAuthentication.bearer')(function* (httpEffect, { credential }) {
      yield* setPrivateResponseHeaders;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const bearerToken = Redacted.value(credential);
      if (
        bearerToken.length === 0 ||
        request.cookies[sessionCookieName] !== undefined ||
        request.cookies[csrfCookieName] !== undefined
      ) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      return yield* Effect.provideService(httpEffect, ApiCredentials, {
        kind: 'integration-token',
        token: bearerToken,
      });
    }),
  }),
);

const ApiAuthorizationLive = Layer.effect(
  ApiAuthorization,
  Effect.gen(function* () {
    const authentication = yield* Authentication;
    const config = yield* AuthenticationConfig;
    const integrationTokens = yield* IntegrationTokens;
    const limiter = yield* RequestLimiter;
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
          () => new Error(`Endpoint ${endpoint.identifier} has no required permission.`),
        );
        const endpointRateLimit = Context.getOption(endpoint.annotations, EndpointRateLimit);

        if (credentials.kind === 'session') {
          const principal = yield* authentication
            .authorize(credentials.token, permissions, 'administrator')
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          if (HttpMethod.hasBody(endpoint.method)) {
            const request = yield* HttpServerRequest.HttpServerRequest;
            if (request.headers['origin'] !== config.publicOrigin) {
              return yield* new RequestInvalidOrigin({ code: 'request.invalid_origin' });
            }
            yield* authentication
              .authorizeCsrf(
                credentials.token,
                request.cookies[csrfCookieName],
                request.headers[csrfHeaderName],
                request.headers['origin'],
              )
              .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          }
          if (Option.isSome(endpointRateLimit)) {
            yield* limitEndpoint(principal.userId, endpoint.identifier, endpointRateLimit.value);
          }
          return yield* Effect.provideService(httpEffect, ApiPrincipal, {
            userId: Schema.decodeUnknownSync(Ulid)(principal.userId),
            credential: { kind: 'session', token: credentials.token },
          });
        }

        if (
          !(yield* limiter.allowRequest(
            `integration-auth:address:${yield* getClientAddress()}`,
            AuthenticationRateLimits.integrationAttemptsPerAddressPerMinute,
          ))
        ) {
          return yield* new RequestRateLimited({ code: 'request.rate_limited' });
        }
        const principal = yield* integrationTokens
          .authenticate(credentials.token)
          .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        if (
          !(yield* limiter.allowRequest(
            `integration-token:${principal.tokenId}:all`,
            principal.rateLimitPerMinute,
          ))
        ) {
          return yield* new RequestRateLimited({ code: 'request.rate_limited' });
        }
        for (const permission of permissions) {
          yield* integrationTokens
            .authorizePermission(principal, permission)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }
        if (Option.isSome(endpointRateLimit)) {
          yield* limitEndpoint(principal.tokenId, endpoint.identifier, endpointRateLimit.value);
        }
        return yield* Effect.provideService(httpEffect, ApiPrincipal, {
          userId: principal.userId,
          credential: { kind: 'integration-token', tokenId: principal.tokenId },
        });
      }),
    );
  }),
);

const ApiBrowserRequestLive = Layer.effect(
  ApiBrowserRequest,
  Effect.gen(function* () {
    const config = yield* AuthenticationConfig;
    return ApiBrowserRequest.of(
      Effect.fn('ApiBrowserRequest')(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers['origin'] !== config.publicOrigin) {
          return yield* new RequestInvalidOrigin({ code: 'request.invalid_origin' });
        }
        return yield* httpEffect;
      }),
    );
  }),
);

const ApiRequestBodyLive = Layer.succeed(
  ApiRequestBody,
  ApiRequestBody.of(
    Effect.fn('ApiRequestBody')(function* (httpEffect) {
      yield* setPrivateResponseHeaders;
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.headers['transfer-encoding'] !== undefined) {
        return yield* new RequestTooLarge({ code: 'request.too_large' });
      }
      const contentLength = Schema.decodeUnknownOption(Schema.NumberFromString)(
        request.headers['content-length'],
      );
      if (
        Option.isSome(contentLength) &&
        contentLength.value > Number(RequestBodyLimits.thirtyTwoKiB)
      ) {
        return yield* new RequestTooLarge({ code: 'request.too_large' });
      }
      return yield* httpEffect.pipe(
        Effect.mapError((error) =>
          error instanceof HttpServerError.HttpServerError &&
          error.reason._tag === 'RequestParseError'
            ? new RequestTooLarge({ code: 'request.too_large' })
            : error,
        ),
      );
    }),
  ),
);

export const ApiPolicyMiddlewareLive = Layer.mergeAll(
  ApiAuthenticationLive,
  ApiAuthorizationLive,
  ApiBrowserRequestLive,
  ApiRequestBodyLive,
);
