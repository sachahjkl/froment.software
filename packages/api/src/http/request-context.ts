import { Context } from 'effect';

export interface ApiRequestTelemetry {
  readonly operation: string;
  readonly route: string;
}

export interface RecordedAuditEvent {
  readonly id: string;
  readonly action: string;
  readonly actorUserId: string | null;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly isCommitted: () => boolean;
}

export interface RequestContextService {
  readonly requestId: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly apiTelemetry: () => ApiRequestTelemetry | undefined;
  readonly setApiTelemetry: (telemetry: ApiRequestTelemetry) => void;
  readonly recordedAuditEvents: () => ReadonlyArray<RecordedAuditEvent>;
  readonly recordAuditEvent: (event: RecordedAuditEvent) => void;
}

export class RequestContext extends Context.Service<RequestContext, RequestContextService>()(
  '@froment/api/RequestContext',
) {}
