import { Schema } from 'effect';

export const GitCommit = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/));

export const PackageVersion = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
});

export const DeploymentMetadata = Schema.Struct({
  commit: GitCommit,
  packages: Schema.Array(PackageVersion),
});
export type DeploymentMetadata = typeof DeploymentMetadata.Type;
