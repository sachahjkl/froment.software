import { argon2id, hash, verify, type HashOptions } from 'argon2';
import { RequestRateLimited } from '@froment/contracts';
import { Context, Effect, Layer, Option, Schema, Semaphore } from 'effect';

import { RuntimeConfiguration } from '../runtime-config.js';

export class PasswordHashError extends Schema.TaggedError<PasswordHashError>()(
  'PasswordHashError',
  { cause: Schema.Defect() },
) {}

export interface PasswordService {
  readonly hash: (password: string) => Effect.Effect<string, PasswordHashError>;
  readonly verify: (
    passwordHash: string,
    password: string,
  ) => Effect.Effect<boolean, RequestRateLimited>;
}

export class Passwords extends Context.Service<Passwords, PasswordService>()(
  '@froment/api/Passwords',
) {}

export class Argon2 extends Context.Service<
  Argon2,
  {
    readonly hash: (password: string, options: HashOptions) => Promise<string>;
    readonly verify: (passwordHash: string, password: string) => Promise<boolean>;
  }
>()('@froment/api/Argon2') {}

export const PasswordsLayer = Layer.effect(
  Passwords,
  Effect.gen(function* () {
    const config = (yield* RuntimeConfiguration).password;
    const algorithm = yield* Argon2;
    const { verificationConcurrency, ...hashOptions } = config;
    const options = { ...hashOptions, type: argon2id } as const;
    const verificationSlots = yield* Semaphore.make(verificationConcurrency);
    return Passwords.of({
      hash: Effect.fn('Passwords.hash')((password: string) =>
        Effect.tryPromise({
          try: async () => {
            return await algorithm.hash(password, options);
          },
          catch: (cause) => new PasswordHashError({ cause }),
        }),
      ),
      verify: Effect.fn('Passwords.verify')((passwordHash: string, password: string) =>
        Effect.tryPromise({
          try: async () => {
            return await algorithm.verify(passwordHash, password);
          },
          catch: () => false,
        }).pipe(
          Effect.catch(() => Effect.succeed(false)),
          // Native Argon2 cannot be cancelled. Retain the slot until it finishes.
          Effect.uninterruptible,
          verificationSlots.withPermitsIfAvailable(1),
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new RequestRateLimited({ code: 'request.rate_limited' })),
              onSome: Effect.succeed,
            }),
          ),
        ),
      ),
    });
  }),
);

export const PasswordsLive = PasswordsLayer.pipe(
  Layer.provide(Layer.succeed(Argon2, { hash, verify })),
);
