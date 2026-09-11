import { Effect, Layer } from 'effect';
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, HttpApiGroup } from 'effect/unstable/httpapi';
import { describe, expect, it, vi } from 'vitest';

import { ClientsApi } from '../../../contracts/src/clients/api.js';
import { Authentication } from './authentication.js';
import { AuthenticationConfig } from './authentication-config.js';
import { authenticationConfig } from './authentication-config.spec-helper.js';
import { AuthenticationHttpLive, accessCookieName } from './http.js';
import { ApiTokens } from '../api-tokens/service.js';
import { Audit } from '../audit/audit.js';
import { RequestLimiterLive } from '../server/request-limiter.js';
import { ApiRequestBodyLive } from '../http/request-body.js';

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const sessionId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
const origin = 'https://example.test';
const TestApi = HttpApi.make('origin-test').add(
  HttpApiGroup.make('clients').add(
    ClientsApi.endpoints.clientArchive,
    ClientsApi.endpoints.clientList,
    ClientsApi.endpoints.clientUpdate,
  ),
);

const fixture = () => {
  const mutate = vi.fn(() => Effect.succeed(HttpServerResponse.empty()));
  const authorize = vi.fn<Authentication['Service']['authorize']>(() =>
    Effect.succeed({
      userId,
      sessionId,
      email: 'review@example.test',
      mode: 'administrator',
    }),
  );
  const authenticate = vi.fn<ApiTokens['Service']['authenticate']>(() =>
    Effect.succeed({
      userId,
      tokenId: sessionId,
      rateLimitPerMinute: 120,
    }),
  );
  const auth = AuthenticationHttpLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthenticationConfig, authenticationConfig),
        Layer.mock(Authentication, { authorize }),
        Layer.mock(ApiTokens, { authenticate, authorizePermission: () => Effect.void }),
        Layer.mock(Audit, { insert: () => userId }),
        RequestLimiterLive,
      ),
    ),
  );
  const handlers = HttpApiBuilder.group(TestApi, 'clients', (handlers) =>
    handlers
      .handleRaw('clientArchive', mutate)
      .handleRaw('clientUpdate', mutate)
      .handleRaw('clientList', () => Effect.succeed(HttpServerResponse.empty())),
  );
  return {
    mutate,
    authorize,
    authenticate,
    routes: HttpApiBuilder.layer(TestApi).pipe(
      Layer.provide(handlers),
      Layer.provide(auth),
      Layer.provide(ApiRequestBodyLive),
      Layer.provide(HttpServer.layerServices),
    ),
  };
};

describe('Cookie origin policy', () => {
  it.each([
    undefined,
    'null',
    'https://untrusted.example.test',
    'https://other.test',
    'http://example.test',
  ])('rejects a cookie mutation with Origin %s before authorization or mutation', async (value) => {
    const test = fixture();
    const server = HttpRouter.toWebHandler(test.routes, { disableLogger: true });
    try {
      for (const [method, path] of [
        ['POST', `/api/clients/${userId}/archive`],
        ['PUT', `/api/clients/${userId}`],
      ]) {
        const headers = new Headers({ cookie: `${accessCookieName}=v4.public.fixture` });
        if (value !== undefined) headers.set('origin', value);
        const response = await server.handler(new Request(`${origin}${path}`, { method, headers }));
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          _tag: 'RequestInvalidOrigin',
          code: 'request.invalid_origin',
        });
      }
      expect(test.mutate).not.toHaveBeenCalled();
      expect(test.authorize).not.toHaveBeenCalled();
    } finally {
      await server.dispose();
    }
  });

  it('allows same-origin cookie mutations and originless cookie reads', async () => {
    const test = fixture();
    const server = HttpRouter.toWebHandler(test.routes, { disableLogger: true });
    try {
      const cookie = `${accessCookieName}=v4.public.fixture`;
      expect(
        (
          await server.handler(
            new Request(`${origin}/api/clients/${userId}/archive`, {
              method: 'POST',
              headers: { cookie, origin },
            }),
          )
        ).status,
      ).toBe(204);
      expect(
        (await server.handler(new Request(`${origin}/api/clients`, { headers: { cookie } })))
          .status,
      ).toBe(204);
      expect(test.mutate).toHaveBeenCalledTimes(1);
      expect(test.authorize).toHaveBeenCalledTimes(2);
    } finally {
      await server.dispose();
    }
  });

  it('keeps Bearer mutations independent of Origin and rejects mixed credentials', async () => {
    const test = fixture();
    const server = HttpRouter.toWebHandler(test.routes, { disableLogger: true });
    try {
      const authorization = 'Bearer froment_api_v1_fixture';
      for (const value of [undefined, 'https://other.test']) {
        const headers = new Headers({ authorization });
        if (value !== undefined) headers.set('origin', value);
        expect(
          (
            await server.handler(
              new Request(`${origin}/api/clients/${userId}/archive`, { method: 'POST', headers }),
            )
          ).status,
        ).toBe(204);
      }
      expect(
        (
          await server.handler(
            new Request(`${origin}/api/clients/${userId}/archive`, {
              method: 'POST',
              headers: { authorization, origin, cookie: `${accessCookieName}=v4.public.fixture` },
            }),
          )
        ).status,
      ).toBe(401);
      expect(test.mutate).toHaveBeenCalledTimes(2);
      expect(test.authenticate).toHaveBeenCalledTimes(2);
    } finally {
      await server.dispose();
    }
  });
});
