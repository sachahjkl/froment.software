import { Layer } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { OtlpSerialization, OtlpTracer } from 'effect/unstable/observability';

export const ObservabilityLive = OtlpTracer.layerFromConfig({
  resource: {
    serviceName: 'froment-software',
    serviceVersion: '0.0.0',
  },
}).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer));
