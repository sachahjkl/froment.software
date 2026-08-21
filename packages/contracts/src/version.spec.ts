import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { DeploymentMetadata } from './version.js';

const validMetadata = {
  commit: '6c9757782e249d4db6ffb804349b7da620494565',
  packages: [{ name: '@froment/api', version: '0.1.0' }],
};

describe('deployment metadata contract', () => {
  it('accepts an exact commit and package versions', () => {
    expect(Schema.decodeUnknownSync(DeploymentMetadata)(validMetadata)).toEqual(validMetadata);
  });

  it('rejects an inexact commit', () => {
    expect(() =>
      Schema.decodeUnknownSync(DeploymentMetadata)({ ...validMetadata, commit: '6c975778-dirty' }),
    ).toThrow();
  });

  it('rejects incomplete package metadata', () => {
    expect(() =>
      Schema.decodeUnknownSync(DeploymentMetadata)({ ...validMetadata, packages: [{ name: '' }] }),
    ).toThrow();
  });
});
