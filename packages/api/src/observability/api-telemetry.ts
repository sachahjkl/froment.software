import { ApiTelemetry } from '@froment/contracts';
import { Context, Effect, Layer } from 'effect';

import { RequestContext } from '../http/request-context.js';

export const ApiTelemetryLive = Layer.succeed(
  ApiTelemetry,
  ApiTelemetry.of((httpEffect, { endpoint }) =>
    Effect.withFiber((fiber) => {
      const telemetry = {
        operation: endpoint.identifier,
        route: endpoint.path,
      };
      Context.getUnsafe(fiber.context, RequestContext).setApiTelemetry(telemetry);
      return httpEffect.pipe(
        Effect.annotateLogs({
          'api.operation': telemetry.operation,
          'http.route': telemetry.route,
        }),
        Effect.annotateSpans({ 'api.operation': telemetry.operation }),
      );
    }),
  ),
);
