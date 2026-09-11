import {
  ApiTelemetry,
  AuthenticationRequired,
  PermissionDenied,
  type GlobalAuditPage,
} from '@froment/contracts';
import { ConfigProvider, Effect, Layer } from 'effect';
import { HttpRouter, HttpServer, UrlParams } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';
import { describe, expect, it, vi } from 'vitest';

import { AuditApi } from '../../../contracts/src/audit/api.js';
import { ApiTokens } from '../api-tokens/service.js';
import { Authentication, type AuthenticationService } from '../authentication/authentication.js';
import { accessCookieName, AuthenticationHttpLive } from '../authentication/http.js';
import { AuthenticationConfig } from '../authentication/authentication-config.js';
import { authenticationConfig } from '../authentication/authentication-config.spec-helper.js';
import { DatabaseError } from '../database/database.js';
import { RuntimeConfigurationLive } from '../runtime-config.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { Audit } from './audit.js';
import { AuditHandlers } from './handlers.js';
import { AuditReader } from './reader.js';

const TestApi = HttpApi.make('froment-api').add(AuditApi).middleware(ApiTelemetry);
const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const sessionId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
const page: GlobalAuditPage = {
  items: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      action: 'quote.created',
      actorUserId: userId,
      resourceType: 'quote',
      resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      occurredAt: '2026-08-20T05:30:00.000Z',
    },
  ],
  previousCursor: null,
  nextCursor: null,
};
const privateFields = {
  metadata: {
    password: 'private-password',
    accessToken: 'v4.public.private-token',
    secret: 'private-secret',
  },
  requestId: 'private-request-id',
  traceId: 'private-trace-id',
  spanId: 'private-span-id',
  payload: 'private-provider-payload',
};
const readerPage = {
  ...page,
  items: page.items.map((event) => ({ ...event, ...privateFields })),
};

const expectPrivateResponse = (response: Response) => {
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(response.headers.get('vary')).toBe('Cookie, Authorization');
};

const fixtures = (
  options: {
    readonly credential?: 'administrator' | 'collaborator' | 'expired' | 'api-token';
    readonly query?: Readonly<Record<string, string | ReadonlyArray<string> | undefined>>;
    readonly unavailable?: boolean;
    readonly pageSize?: number;
    readonly result?: GlobalAuditPage;
  } = {},
) => {
  const list = vi.fn<AuditReader['Service']['list']>(() =>
    options.unavailable
      ? Effect.fail(
          new DatabaseError({ operation: 'read.audit.events', cause: 'Private database detail' }),
        )
      : Effect.succeed(options.result ?? readerPage),
  );
  const authorize = vi.fn<AuthenticationService['authorize']>((token) => {
    if (token === 'v4.public.administrator') {
      return Effect.succeed({
        userId,
        sessionId,
        email: 'audit@example.test',
        mode: 'administrator',
      });
    }
    return token === 'v4.public.collaborator'
      ? Effect.fail(new PermissionDenied({ code: 'authentication.permission_denied' }))
      : Effect.fail(new AuthenticationRequired({ code: 'authentication.required' }));
  });
  const authorizePermission = vi.fn<ApiTokens['Service']['authorizePermission']>(() =>
    Effect.fail(new PermissionDenied({ code: 'authentication.permission_denied' })),
  );
  const configuration = RuntimeConfigurationLive.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown(
          options.pageSize === undefined ? {} : { AUDIT_PAGE_SIZE: String(options.pageSize) },
        ),
      ),
    ),
  );
  const authLayer = AuthenticationHttpLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthenticationConfig, authenticationConfig),
        Layer.mock(Authentication, { authorize }),
        Layer.mock(ApiTokens, {
          authenticate: () =>
            Effect.succeed({ userId, tokenId: sessionId, rateLimitPerMinute: 60 }),
          authorizePermission,
        }),
        Layer.mock(Audit, { insert: () => userId }),
        Layer.mock(RequestLimiter, { allowRequest: () => Effect.succeed(true) }),
        configuration,
      ),
    ),
  );
  const handlers = AuditHandlers.pipe(
    Layer.provide(configuration),
    Layer.provide(Layer.succeed(AuditReader, AuditReader.of({ list }))),
    Layer.provide(authLayer),
    Layer.provide(
      Layer.succeed(
        ApiTelemetry,
        ApiTelemetry.of((httpEffect) => httpEffect),
      ),
    ),
  );
  const routes = HttpApiBuilder.layer(TestApi).pipe(
    Layer.provide(handlers),
    Layer.provide(HttpServer.layerServices),
  );
  const request = async () => {
    const server = HttpRouter.toWebHandler(routes, { disableLogger: true });
    try {
      const headers = new Headers();
      if (options.credential === 'api-token') {
        headers.set('authorization', 'Bearer froment_api_v1_test');
      } else if (options.credential !== undefined) {
        headers.set('cookie', `${accessCookieName}=v4.public.${options.credential}`);
      }
      const query = UrlParams.toString(UrlParams.fromInput(options.query ?? {}));
      return await server.handler(
        new Request(`http://localhost/api/audit-events?${query}`, { headers }),
      );
    } finally {
      await server.dispose();
    }
  };
  return { request, list, authorize, authorizePermission };
};

describe('Audit HTTP boundary', () => {
  it('rejects a limit above the configured size before calling the reader', async () => {
    const fixture = fixtures({ credential: 'administrator', pageSize: 3, query: { limit: '4' } });
    const response = await fixture.request();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      _tag: 'InvalidAuditQuery',
      code: 'audit.invalid_query',
    });
    expect(fixture.list).not.toHaveBeenCalled();
    expectPrivateResponse(response);
  });

  it('accepts a configured size above fifty in the query and HTTP response', async () => {
    const event = page.items[0];
    if (event === undefined) throw new Error('Missing audit event fixture');
    const result = { ...page, items: Array.from({ length: 75 }, () => event) };
    const fixture = fixtures({
      credential: 'administrator',
      pageSize: 75,
      query: { limit: '75' },
      result,
    });
    const response = await fixture.request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ limit: 75 });
    expectPrivateResponse(response);
  });

  it('accepts a smaller explicit limit under the configured size', async () => {
    const fixture = fixtures({ credential: 'administrator', pageSize: 3, query: { limit: '2' } });
    const response = await fixture.request();
    expect(response.status).toBe(200);
    expect(fixture.list).toHaveBeenCalledExactlyOnceWith({ limit: 2 });
    expectPrivateResponse(response);
  });

  it.each([
    { credential: undefined, status: 401 },
    { credential: 'expired' as const, status: 401 },
    { credential: 'collaborator' as const, status: 403 },
    { credential: 'api-token' as const, status: 403 },
  ])('returns no audit data for $credential', async ({ credential, status }) => {
    const fixture = fixtures(credential === undefined ? {} : { credential });
    const response = await fixture.request();
    expect(response.status).toBe(status);
    expect(fixture.list).not.toHaveBeenCalled();
    expectPrivateResponse(response);
    const body: unknown = await response.json();
    expect(body).toEqual(
      status === 401
        ? { _tag: 'AuthenticationRequired', code: 'authentication.required' }
        : { _tag: 'PermissionDenied', code: 'authentication.permission_denied' },
    );
    expect(JSON.stringify(body)).not.toContain('quote.created');
    expect(body).not.toHaveProperty('items');
    if (credential === undefined || credential === 'api-token') {
      expect(fixture.authorize).not.toHaveBeenCalled();
    }
    if (credential === 'collaborator' || credential === 'expired') {
      expect(fixture.authorize).toHaveBeenCalledWith(
        `v4.public.${credential}`,
        ['audit.read'],
        'administrator',
      );
    }
    if (credential === 'api-token') {
      expect(fixture.authorizePermission).toHaveBeenCalledWith(
        { userId, tokenId: sessionId, rateLimitPerMinute: 60 },
        'audit.read',
      );
    } else {
      expect(fixture.authorizePermission).not.toHaveBeenCalled();
    }
  });

  it('uses real authorization middleware and decodes filters before the reader', async () => {
    const fixture = fixtures({
      credential: 'administrator',
      query: {
        limit: '2',
        cursor: userId,
        direction: 'newer',
        action: 'quote.created',
        resourceType: 'quote',
      },
    });
    const response = await fixture.request();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expectPrivateResponse(response);
    expect(fixture.authorize).toHaveBeenCalledWith(
      'v4.public.administrator',
      ['audit.read'],
      'administrator',
    );
    expect(fixture.list).toHaveBeenCalledWith({
      limit: 2,
      cursor: userId,
      direction: 'newer',
      action: 'quote.created',
      resourceType: 'quote',
    });
    expect(fixture.list).toHaveBeenCalledTimes(1);
  });

  it('excludes secrets, metadata, payloads and correlation fields from the HTTP response', async () => {
    const fixture = fixtures({ credential: 'administrator' });
    const response = await fixture.request();
    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toEqual(page);
    expect(JSON.stringify(body)).not.toContain('private-');
    for (const field of Object.keys(privateFields)) {
      expect(body).not.toHaveProperty(`items.0.${field}`);
    }
    expectPrivateResponse(response);
    expect(fixture.list).toHaveBeenCalledExactlyOnceWith({});
  });

  it.each([
    { cursor: 'invalid' },
    { cursor: [userId, sessionId] },
    { limit: '51' },
    { limit: '0' },
    { limit: '2.5' },
    { limit: ['2', '3'] },
    { action: 'Unknown action' },
    { resourceType: "quote' OR 1=1 --" },
    { direction: 'newer' },
  ])('rejects malformed HTTP query %j before reading', async (query) => {
    const fixture = fixtures({ credential: 'administrator', query });
    const response = await fixture.request();
    expect(response.status).toBe(400);
    expect(fixture.list).not.toHaveBeenCalled();
    expectPrivateResponse(response);
  });

  it('returns a typed unavailable error without database details', async () => {
    const fixture = fixtures({ credential: 'administrator', unavailable: true });
    const response = await fixture.request();
    expect(response.status).toBe(503);
    const body: unknown = await response.json();
    expect(body).toEqual({ _tag: 'AuditUnavailable', code: 'audit.unavailable' });
    expect(JSON.stringify(body)).not.toContain('Private database detail');
    expect(JSON.stringify(body)).not.toContain('read.audit.events');
    expect(fixture.list).toHaveBeenCalledExactlyOnceWith({});
    expectPrivateResponse(response);
  });
});
