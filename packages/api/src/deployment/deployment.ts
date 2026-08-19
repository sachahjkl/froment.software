import { DeploymentMetadata, type DeploymentMetadataValue } from '@froment/contracts';
import { Config, Context, Effect, Layer, Schema } from 'effect';

export interface DeploymentService {
  readonly metadata: DeploymentMetadataValue;
}

export class Deployment extends Context.Service<Deployment, DeploymentService>()(
  '@froment/api/Deployment',
) {}

export const DeploymentLive = Layer.effect(
  Deployment,
  Effect.gen(function* () {
    const metadata = yield* Config.schema(
      Schema.fromJsonString(DeploymentMetadata),
      'DEPLOYMENT_METADATA',
    );
    return Deployment.of({ metadata });
  }),
);
