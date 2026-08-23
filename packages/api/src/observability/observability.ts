import { DeploymentMetadata } from '@froment/contracts';
import { Config, Effect, Layer, Schema } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { OtlpLogger, OtlpSerialization, OtlpTracer } from 'effect/unstable/observability';

export const ObservabilityLive = Layer.unwrap(
  Effect.gen(function* () {
    const deployment = yield* Config.schema(
      Schema.fromJsonString(DeploymentMetadata),
      'DEPLOYMENT_METADATA',
    );
    const environment = yield* Config.string('DEPLOYMENT_ENVIRONMENT').pipe(
      Config.withDefault('production'),
    );
    const serviceVersion = deployment.packages.find(
      (candidate) => candidate.name === '@froment/api',
    )?.version;
    const resource = {
      serviceName: 'froment-software',
      serviceVersion,
      attributes: {
        'deployment.environment.name': environment,
        'vcs.ref.head.revision': deployment.commit,
      },
    };
    return Layer.merge(
      OtlpTracer.layerFromConfig({ resource }),
      OtlpLogger.layerFromConfig({ resource }),
    ).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer));
  }),
);
