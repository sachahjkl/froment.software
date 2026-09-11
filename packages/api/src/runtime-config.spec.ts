import { ConfigProvider, Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  defaultRuntimeConfig,
  RuntimeConfiguration,
  RuntimeConfigurationLive,
} from './runtime-config.js';

const load = (values: Readonly<Record<string, string>>) =>
  RuntimeConfiguration.pipe(
    Effect.provide(RuntimeConfigurationLive),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(values))),
  );

describe('RuntimeConfiguration', () => {
  it('loads bounded security limits from the injected provider', async () => {
    const config = await Effect.runPromise(
      load({
        AUTH_LOGIN_ATTEMPTS_PER_MINUTE: '3',
        AUTH_LOGIN_QUOTA_CAPACITY: '4',
        ARGON2_VERIFICATION_CONCURRENCY: '1',
        REQUEST_LIMITER_PUBLIC_CAPACITY: '5',
        HTTP_MAXIMUM_BANK_IMPORT_BODY_BYTES: '600000',
      }),
    );
    expect(config.authentication.loginAttemptsPerMinute).toBe(3);
    expect(config.authentication.loginQuotaCapacity).toBe(4);
    expect(config.password.verificationConcurrency).toBe(1);
    expect(config.requestLimiter.publicCapacity).toBe(5);
    expect(config.http.maximumBankImportBodyBytes).toBe(600_000);
    expect(config.http.maximumRequestBodyBytes).toBe(32_768);
  });
  it.each([
    'AUTH_LOGIN_ATTEMPTS_PER_MINUTE',
    'AUTH_LOGIN_QUOTA_CAPACITY',
    'ARGON2_VERIFICATION_CONCURRENCY',
    'REQUEST_LIMITER_PUBLIC_CAPACITY',
    'HTTP_MAXIMUM_BANK_IMPORT_BODY_BYTES',
  ])('rejects a zero security limit for %s', async (name) => {
    expect((await Effect.runPromise(load({ [name]: '0' }).pipe(Effect.flip)))._tag).toBe(
      'ConfigError',
    );
  });
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
