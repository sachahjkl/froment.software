import { Context } from 'effect';

export interface ApiRequestTelemetry {
  readonly operation: string;
  readonly route: string;
}

export interface RequestContextService {
  readonly requestId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly apiTelemetry: () => ApiRequestTelemetry | undefined;
  readonly setApiTelemetry: (telemetry: ApiRequestTelemetry) => void;
}

export class RequestContext extends Context.Service<RequestContext, RequestContextService>()(
  '@froment/api/RequestContext',
) {}
