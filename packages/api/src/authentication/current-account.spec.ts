import {
  ApiAuthentication,
  ApiBrowserRequest,
  ApiCredentials,
  ApiRequestBody,
  ApiTelemetry,
  CurrentAccount,
  type ApiCredentialsValue,
} from '@froment/contracts';
import { Effect, Layer, Schema } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder } from 'effect/unstable/httpapi';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticationApi } from '../../../contracts/src/authentication/api.js';
import { RuntimeConfigurationDefaults } from '../runtime-config.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { Company } from '../company/service.js';
import { Authentication } from './authentication.js';
import { AuthenticationConfig } from './authentication-config.js';
import { AuthenticationHandlers } from './handlers.js';

const account = {
  userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  email: 'accountant@example.test',
  mode: 'administrator' as const,
  permissions: ['client.read', 'invoice.read'] as const,
  enabledModules: ['sales', 'accounting'] as const,
};

const requestAccount = async (credentials: ApiCredentialsValue) => {
  const authenticate = vi.fn(() => Effect.succeed({ ...account, sessionId: 'private-session' }));
  const api = HttpApi.make('froment-api').add(AuthenticationApi).middleware(ApiTelemetry);
  const services = Layer.mergeAll(
    Layer.mock(Authentication, { authenticate }),
    Layer.succeed(AuthenticationConfig, {
      bootstrapPasswordHash: {
        cost: 16384,
        blockSize: 8,
        parallelization: 1,
        salt: Buffer.alloc(16),
        hash: Buffer.alloc(64),
      },
      pasetoSecretKey: '',
      pasetoPublicKey: '',
      publicOrigin: 'http://localhost',
      apiTokenHmacKey: Buffer.alloc(32),
      refreshHmacKey: Buffer.alloc(32),
      quoteLinkHmacKey: Buffer.alloc(32),
    }),
    Layer.mock(RequestLimiter, {}),
    Layer.mock(Company, {
      get: Effect.succeed({
        jurisdiction: 'FR' as const,
        functionalCurrency: 'EUR',
        accountingInitialized: true,
        fiscalYearStartMonth: 1,
        fiscalYearStartDay: 1,
        defaultFiscalYearMonths: 12 as const,
        enabledModules: account.enabledModules,
        retentionYears: 10,
        version: 1,
        updatedAt: 0,
      }),
    }),
    RuntimeConfigurationDefaults,
  );
  const handlers = AuthenticationHandlers.pipe(
    Layer.provide([
      Layer.succeed(
        ApiAuthentication,
        ApiAuthentication.of({
          bearer: (httpEffect) => Effect.provideService(httpEffect, ApiCredentials, credentials),
        }),
      ),
      Layer.succeed(
        ApiBrowserRequest,
        ApiBrowserRequest.of((httpEffect) => httpEffect),
      ),
      Layer.succeed(
        ApiRequestBody,
        ApiRequestBody.of((httpEffect) => httpEffect),
      ),
      Layer.succeed(
        ApiTelemetry,
        ApiTelemetry.of((httpEffect) => httpEffect),
      ),
    ]),
  );
  const server = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(api).pipe(
      Layer.provide(handlers),
      Layer.provide(HttpServer.layerServices),
    ),
    { disableLogger: true },
  );
  try {
    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const context = yield* Layer.build(services);
        return yield* Effect.promise(() =>
          server.handler(new Request('http://localhost/api/auth/account'), context),
        );
      }).pipe(Effect.scoped),
    );
    return { response, authenticate };
  } finally {
    await server.dispose();
  }
};

describe('current account HTTP boundary', () => {
  it('exposes only account fields and effective permissions from the authenticated principal', async () => {
    const { response, authenticate } = await requestAccount({
      kind: 'access-token',
      token: 'test-token',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Schema.decodeUnknownSync(CurrentAccount)(await response.json())).toEqual(account);
    expect(authenticate).toHaveBeenCalledWith('test-token');
  });

  it('rejects API tokens before loading the browser account', async () => {
    const { response, authenticate } = await requestAccount({
      kind: 'api-token',
      token: 'test-token',
    });
    expect(response.status).toBe(401);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
