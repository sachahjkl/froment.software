import { Effect, Exit, Tracer } from 'effect';
import { HttpServerRequest, HttpServerResponse } from 'effect/unstable/http';
import { describe, expect, it } from 'vitest';

import { HttpTracingLive, traceRequest } from './http-tracing.js';

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
      new Request('https://froment.software/api/clients', {
        method: 'POST',
        headers: {
          authorization: 'Bearer another-secret',
          cookie: '__Secure-froment-refresh=refresh-secret',
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
    const serializedAttributes = JSON.stringify([...(attributes?.entries() ?? [])]);
    expect(serializedAttributes).not.toContain('another-secret');
    expect(serializedAttributes).not.toContain('refresh-secret');
  });
});
