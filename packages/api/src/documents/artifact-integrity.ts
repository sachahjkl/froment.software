import { createHash } from 'node:crypto';

export interface StoredArtifactContent {
  readonly content: Uint8Array;
  readonly sha256: string;
}

export const verifyArtifactContent = <Artifact extends StoredArtifactContent>(
  artifact: Artifact,
) => {
  const digest = createHash('sha256').update(artifact.content).digest('hex');
  if (digest !== artifact.sha256) {
    throw new Error('The stored PDF SHA-256 digest does not match its content.');
  }
  return artifact;
};
