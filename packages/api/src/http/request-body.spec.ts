import { BankImportInvalid } from '@froment/contracts';
import { NodeHttpServer } from '@effect/platform-node';
import { Deferred, Effect, Layer, Scope } from 'effect';
import { HttpRouter, HttpServer, HttpServerResponse } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, HttpApiGroup } from 'effect/unstable/httpapi';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';

import { BankingApi } from '../../../contracts/src/banking/api.js';
import { ClientsApi } from '../../../contracts/src/clients/api.js';
import { Authentication } from '../authentication/authentication.js';
import { AuthenticationConfig } from '../authentication/authentication-config.js';
import { authenticationConfig } from '../authentication/authentication-config.spec-helper.js';
import { AuthenticationHttpLive, accessCookieName } from '../authentication/http.js';
import { ApiTokens } from '../api-tokens/service.js';
import { Audit } from '../audit/audit.js';
import { parseBankStatement } from '../banking/csv.js';
import { defaultRuntimeConfig, RuntimeConfiguration } from '../runtime-config.js';
import { RequestLimiterLive } from '../server/request-limiter.js';
import { ApiBrowserRequestLive } from './origin.js';
import { ApiRequestBodyLive } from './request-body.js';

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const TestApi = HttpApi.make('body-test').add(
  HttpApiGroup.make('banking').add(
    BankingApi.endpoints.bankImport,
    BankingApi.endpoints.bankImportPreview,
    ClientsApi.endpoints.clientCreate,
  ),
);
const origin = authenticationConfig.publicOrigin;
const csvHeader = 'transaction_id,booked_on,amount,currency,description\n';
const makeCsv = (rows: number, character = 'x') =>
  csvHeader +
  Array.from(
    { length: rows },
    (_, index) => `ref-${index},2026-09-01,1.00,EUR,${character.repeat(400)}\n`,
  ).join('');

const fixture = (
  maximumBankImportBodyBytes: number = defaultRuntimeConfig.http.maximumBankImportBodyBytes,
) => {
  const parse = vi.fn((csv: string) =>
    Effect.try({
      try: () => parseBankStatement(csv),
      catch: () => new BankImportInvalid({ code: 'bank.import_invalid' }),
    }),
  );
  const clientCreate = vi.fn(() => Effect.succeed(HttpServerResponse.empty()));
  const auth = AuthenticationHttpLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(Authentication, {
          authorize: () =>
            Effect.succeed({
              userId,
              sessionId: userId,
              mode: 'administrator',
              email: 'review@example.test',
            }),
        }),
        Layer.mock(ApiTokens, {}),
        Layer.mock(Audit, { insert: () => userId }),
        RequestLimiterLive,
      ),
    ),
  );
  const handlers = HttpApiBuilder.group(TestApi, 'banking', (handlers) =>
    handlers
      .handle('bankImport', ({ payload }) =>
        parse(payload.csv).pipe(Effect.map((rows) => ({ added: rows.length, existing: 0 }))),
      )
      .handle('bankImportPreview', ({ payload }) =>
        parse(payload.csv).pipe(
          Effect.map((rows) => ({
            added: rows.length,
            existing: 0,
            rows: rows.map((row) => ({ ...row, existing: false })),
          })),
        ),
      )
      .handleRaw('clientCreate', clientCreate),
  );
  const routes = HttpApiBuilder.layer(TestApi).pipe(
    Layer.provide(handlers),
    Layer.provide(Layer.mergeAll(auth, ApiBrowserRequestLive, ApiRequestBodyLive)),
    Layer.provide(Layer.succeed(AuthenticationConfig, authenticationConfig)),
    Layer.provide(
      Layer.succeed(RuntimeConfiguration, {
        ...defaultRuntimeConfig,
        http: { ...defaultRuntimeConfig.http, maximumBankImportBodyBytes },
      }),
    ),
    Layer.provide(HttpServer.layerServices),
  );
  const request = async (path: string, body: string, contentLength?: string) => {
    const server = HttpRouter.toWebHandler(routes, { disableLogger: true });
    try {
      const headers = new Headers({
        origin,
        cookie: `${accessCookieName}=v4.public.fixture`,
        'content-type': 'application/json',
      });
      if (contentLength !== undefined) headers.set('content-length', contentLength);
      return await server.handler(
        new Request(`${origin}${path}`, { method: 'POST', headers, body }),
      );
    } finally {
      await server.dispose();
    }
  };
  const nodeRequest = (body: string, contentLength?: string) =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const application = yield* HttpRouter.toHttpEffect(routes);
          const completed = yield* Deferred.make<HttpServerResponse.HttpServerResponse>();
          const handler = yield* NodeHttpServer.makeHandler(
            application.pipe(Effect.tap((response) => Deferred.succeed(completed, response))),
            { scope: yield* Scope.Scope },
          );
          const socket = new Socket();
          yield* Effect.addFinalizer(() =>
            Effect.sync(() => {
              socket.destroy();
            }),
          );
          const incoming = new IncomingMessage(socket);
          incoming.method = 'POST';
          incoming.url = '/api/banking/import';
          incoming.headers = {
            origin,
            cookie: `${accessCookieName}=v4.public.fixture`,
            'content-type': 'application/json',
          };
          if (contentLength !== undefined) incoming.headers['content-length'] = contentLength;
          handler(incoming, new ServerResponse(incoming));
          incoming.push(Buffer.from(body));
          incoming.push(null);
          return HttpServerResponse.toWeb(yield* Deferred.await(completed));
        }),
      ),
    );
  return { request, nodeRequest, parse, clientCreate };
};

describe('Request body policy', () => {
  it.each(['/api/banking/import', '/api/banking/import/preview'])(
    'accepts a 1000-row UTF-8 CSV on %s without raising other route limits',
    async (path) => {
      const test = fixture();
      const csv = makeCsv(1000, 'é');
      expect(csv.length).toBeLessThanOrEqual(500_000);
      const body = JSON.stringify({ account: 'MAIN', csv });
      expect(Buffer.byteLength(body)).toBeGreaterThan(500_000);
      expect((await test.request(path, body, String(Buffer.byteLength(body)))).status).toBe(200);
      expect(test.parse).toHaveBeenCalledWith(csv);
      expect((await test.request('/api/clients', body)).status).toBe(413);
      expect(test.clientCreate).not.toHaveBeenCalled();
    },
  );

  it('accepts the 500000-character contract boundary with JSON Unicode escapes', async () => {
    const test = fixture();
    const base = makeCsv(1000);
    const extra = 500_000 - base.length;
    let row = 0;
    const csv = base.replace(
      /x{400}/g,
      (description) =>
        description + 'x'.repeat(Math.floor(extra / 1000) + (row++ < extra % 1000 ? 1 : 0)),
    );
    expect(csv.length).toBe(500_000);
    const escaped = csv.replace(
      /[\s\S]/g,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
    const body = `{"account":"MAIN","csv":"${escaped}"}`;
    expect(Buffer.byteLength(body)).toBeGreaterThan(3_000_000);
    expect((await test.request('/api/banking/import', body)).status).toBe(200);
    expect(test.parse).toHaveBeenCalledWith(csv);
    expect(
      (
        await test.request(
          '/api/banking/import',
          JSON.stringify({ account: 'MAIN', csv: csv + 'x' }),
        )
      ).status,
    ).toBe(400);
    expect(test.parse).toHaveBeenCalledTimes(1);
  });

  it('keeps the 1000-row business limit', async () => {
    const test = fixture();
    const response = await test.request(
      '/api/banking/import',
      JSON.stringify({ account: 'MAIN', csv: makeCsv(1001) }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      _tag: 'BankImportInvalid',
      code: 'bank.import_invalid',
    });
  });

  it.each([undefined, '1', '100000'])(
    'enforces the injected byte limit when Content-Length is %s',
    async (contentLength) => {
      const test = fixture(128);
      const body = JSON.stringify({ account: 'MAIN', csv: makeCsv(1) });
      const response = await test.request('/api/banking/import', body, contentLength);
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ _tag: 'RequestTooLarge', code: 'request.too_large' });
      expect(test.parse).not.toHaveBeenCalled();
    },
  );

  it('applies the dedicated limit during native Node body reading without a socket connection', async () => {
    const body = JSON.stringify({ account: 'MAIN', csv: makeCsv(100) });
    const accepted = fixture(100_000);
    expect(Buffer.byteLength(body)).toBeGreaterThan(32_768);
    expect((await accepted.nodeRequest(body)).status).toBe(200);
    expect(accepted.parse).toHaveBeenCalledTimes(1);
    const refused = fixture(128);
    expect((await refused.nodeRequest(body, '1')).status).toBe(413);
    expect(refused.parse).not.toHaveBeenCalled();
  });

  it('does not classify malformed JSON as an oversized body', async () => {
    const test = fixture();
    expect((await test.request('/api/banking/import', '{')).status).toBe(400);
    expect(test.parse).not.toHaveBeenCalled();
  });

  it('accepts exactly the configured bytes and rejects one extra byte', async () => {
    const test = fixture(128);
    const csv = csvHeader + 'one,2026-09-01,1.00,EUR,é\n';
    const json = JSON.stringify({ account: 'MAIN', csv });
    const body = json + ' '.repeat(128 - Buffer.byteLength(json));
    expect(Buffer.byteLength(body)).toBe(128);
    expect((await test.nodeRequest(body, '128')).status).toBe(200);
    expect((await test.nodeRequest(body + ' ', '1')).status).toBe(413);
    expect((await test.request('/api/banking/import', json, '129')).status).toBe(413);
    expect(test.parse).toHaveBeenCalledTimes(1);
  });
});
