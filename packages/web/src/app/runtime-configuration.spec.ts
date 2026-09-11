import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { RuntimeConfiguration } from './runtime-configuration';

describe('RuntimeConfiguration', () => {
  it('uses development when the runtime script is unavailable', () => {
    globalThis.fromentRuntimeConfig = undefined;
    expect(TestBed.inject(RuntimeConfiguration).value).toEqual({
      appEnvironment: 'development',
      sitePhase: 'live',
    });
  });

  it('identifies the production construction phase', () => {
    globalThis.fromentRuntimeConfig = {
      appEnvironment: 'production',
      sitePhase: 'construction',
    };
    const runtime = TestBed.inject(RuntimeConfiguration);
    expect(runtime.value).toEqual(globalThis.fromentRuntimeConfig);
    expect(runtime.productionConstruction).toBe(true);
  });
});
