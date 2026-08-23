import { Effect, Exit, Logger, Tracer } from 'effect';
import { HttpServerRequest, HttpServerResponse } from 'effect/unstable/http';
import { describe, expect, it } from 'vitest';

import { type RecordedAuditEvent, RequestContext } from '../http/request-context.js';
import { HttpTracingLive, logRequest, traceRequest } from './http-tracing.js';

describe('HTTP tracing', () => {
  it('redacts authentication headers through the real tracing middleware', async () => {
    let endSpan = () => {};
    const spanEnded = new Promise<void>((resolve) => {
      endSpan = resolve;
    });
    class CapturedSpan extends Tracer.NativeSpan {
      override end(endTime: bigint, exit: Exit.Exit<unknown, unknown>) {
        super.end(endTime, exit);
        endSpan();
      }
    }
    const spans: Array<Tracer.NativeSpan> = [];
    const tracer = Tracer.make({
      span: (options) => {
        const span = new CapturedSpan(options);
        spans.push(span);
        return span;
      },
    });
    const request = HttpServerRequest.fromWeb(
      new Request('https://froment.software/api/clients?email=private@example.test', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer another-secret',
          cookie: '__Secure-froment-refresh=refresh-secret',
          host: 'froment.software',
          'x-customer-reference': 'private-customer',
          'x-forwarded-proto': 'https',
        },
      }),
    );

    await Effect.runPromise(
      Effect.andThen(
        traceRequest(Effect.succeed(HttpServerResponse.empty())),
        Effect.promise(() => spanEnded),
      ).pipe(
        Effect.provideService(HttpServerRequest.HttpServerRequest, request),
        Effect.provideService(Tracer.Tracer, tracer),
        Effect.provide(HttpTracingLive),
      ),
    );

    const attributes = spans[0]?.attributes;
    expect(attributes?.get('http.request.header.authorization')).toBe('<redacted>');
    expect(attributes?.get('http.request.header.cookie')).toBe('<redacted>');
    expect(attributes?.get('http.request.header.content-type')).toBe('application/json');
    expect(attributes?.get('http.request.header.x-customer-reference')).toBe('<redacted>');
    expect(attributes?.get('url.full')).toBe('https://froment.software/api/clients');
    expect(attributes?.has('url.query')).toBe(false);
    const serializedAttributes = JSON.stringify([...(attributes?.entries() ?? [])]);
    expect(serializedAttributes).not.toContain('another-secret');
    expect(serializedAttributes).not.toContain('refresh-secret');
    expect(serializedAttributes).not.toContain('private@example.test');
    expect(serializedAttributes).not.toContain('private-customer');
  });

  it('logs API, audit, static, and failed responses at their configured levels', async () => {
    const logs: Array<unknown> = [];
    const logger = Logger.make((options) => logs.push(Logger.formatStructured.log(options)));
    const request = HttpServerRequest.fromWeb(new Request('https://froment.software/app.js'));
    const run = (
      status: number,
      apiTelemetry: { readonly operation: string; readonly route: string } | undefined,
      auditEvents: ReadonlyArray<RecordedAuditEvent>,
    ) => {
      const context = RequestContext.of({
        requestId: '45b0257f-8a17-40d8-bb8d-f7bc6bc50f4a',
        traceId: '0123456789abcdef0123456789abcdef',
        spanId: '0123456789abcdef',
        apiTelemetry: () => apiTelemetry,
        setApiTelemetry: () => {},
        recordedAuditEvents: () => auditEvents,
        recordAuditEvent: () => {},
      });
      return Effect.runPromise(
        logRequest(Effect.succeed(HttpServerResponse.empty({ status }))).pipe(
          Effect.provideService(HttpServerRequest.HttpServerRequest, request),
          Effect.provideService(RequestContext, context),
          Effect.provide(Logger.layer([logger])),
        ),
      );
    };

    await run(200, { operation: 'clientList', route: '/api/clients' }, [
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        action: 'client.created',
        actorUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        resourceType: 'client',
        resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        isCommitted: () => true,
      },
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
        action: 'quote.expired',
        actorUserId: null,
        resourceType: 'quote',
        resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
        isCommitted: () => true,
      },
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FB0',
        action: 'quote.created',
        actorUserId: null,
        resourceType: 'quote',
        resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FB1',
        isCommitted: () => false,
      },
    ]);
    await run(200, undefined, []);
    await run(404, undefined, []);

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'INFO',
          message: 'http.response.sent',
          annotations: expect.objectContaining({ 'api.operation': 'clientList' }),
        }),
        expect.objectContaining({
          level: 'INFO',
          message: 'audit.event.recorded',
          annotations: expect.objectContaining({
            'audit.action': 'client.created',
            'actor.user.id': '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          }),
        }),
        expect.objectContaining({
          level: 'WARN',
          message: 'http.response.sent',
          annotations: expect.objectContaining({ 'http.status': 404 }),
        }),
      ]),
    );
  });
});
