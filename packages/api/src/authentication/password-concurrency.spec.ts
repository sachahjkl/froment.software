import { Effect, Fiber } from 'effect';
import { expect, it, vi } from 'vitest';

import { defaultRuntimeConfig, RuntimeConfiguration } from '../runtime-config.js';
import { Argon2, Passwords, PasswordsLayer } from './password.js';

it('refuses excess verification and retains native slots across interruption', async () => {
  let signalStarted = () => {};
  let finishVerification = (_value: boolean) => {};
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const finish = new Promise<boolean>((resolve) => {
    finishVerification = resolve;
  });
  const verify = vi.fn(() => {
    signalStarted();
    return finish;
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      const passwords = yield* Passwords;
      const pending = yield* Effect.forkChild(passwords.verify('fixture', 'password'));
      yield* Effect.promise(() => started);
      const interruption = yield* Effect.forkChild(Fiber.interrupt(pending));
      expect(yield* Effect.result(passwords.verify('fixture', 'password'))).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'RequestRateLimited' },
      });
      expect(verify).toHaveBeenCalledTimes(1);
      finishVerification(true);
      yield* Fiber.join(interruption);
      expect(yield* passwords.verify('fixture', 'password')).toBe(true);
      expect(verify).toHaveBeenCalledTimes(2);
      verify.mockRejectedValueOnce(new Error('invalid.hash'));
      expect(yield* passwords.verify('fixture', 'password')).toBe(false);
      expect(yield* passwords.verify('fixture', 'password')).toBe(true);
    }).pipe(
      Effect.provide(PasswordsLayer),
      Effect.provideService(Argon2, {
        hash: () => Promise.reject(new Error('unexpected.hash')),
        verify,
      }),
      Effect.provideService(RuntimeConfiguration, {
        ...defaultRuntimeConfig,
        password: { ...defaultRuntimeConfig.password, verificationConcurrency: 1 },
      }),
    ),
  );
});
