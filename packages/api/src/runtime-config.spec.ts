import { ConfigProvider, Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  defaultRuntimeConfig,
  RuntimeConfiguration,
  RuntimeConfigurationLive,
} from './runtime-config.js';

const load = (values: { readonly AUDIT_PAGE_SIZE?: string }) =>
  RuntimeConfiguration.pipe(
    Effect.provide(RuntimeConfigurationLive),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(values))),
  );

describe('RuntimeConfiguration', () => {
  it('loads the declared defaults through Effect Config', async () => {
    expect(await Effect.runPromise(load({}))).toEqual(defaultRuntimeConfig);
  });

  it('loads independent audit page sizes from each provider', async () => {
    const small = await Effect.runPromise(load({ AUDIT_PAGE_SIZE: '3' }));
    const large = await Effect.runPromise(load({ AUDIT_PAGE_SIZE: '75' }));
    const defaults = await Effect.runPromise(load({}));
    expect(small.audit.pageSize).toBe(3);
    expect(large.audit.pageSize).toBe(75);
    expect(defaults.audit.pageSize).toBe(50);
  });

  it('uses the default for an empty string treated as absent by the Effect provider', async () => {
    const config = await Effect.runPromise(load({ AUDIT_PAGE_SIZE: '' }));
    expect(config.audit.pageSize).toBe(50);
  });

  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', 'invalid', '9007199254740992'])(
    'rejects AUDIT_PAGE_SIZE=%j instead of using the default',
    async (pageSize) => {
      const error = await Effect.runPromise(load({ AUDIT_PAGE_SIZE: pageSize }).pipe(Effect.flip));
      expect(error._tag).toBe('ConfigError');
    },
  );
});
