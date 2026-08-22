import { argon2id, hash, verify } from 'argon2';
import { Context, Effect, Layer, Schema } from 'effect';

import { RuntimeConfiguration } from '../runtime-config.js';

export class PasswordHashError extends Schema.TaggedError<PasswordHashError>()(
  'PasswordHashError',
  { cause: Schema.Defect() },
) {}

export interface PasswordService {
  readonly hash: (password: string) => Effect.Effect<string, PasswordHashError>;
  readonly verify: (passwordHash: string, password: string) => Effect.Effect<boolean>;
}

export class Passwords extends Context.Service<Passwords, PasswordService>()(
  '@froment/api/Passwords',
) {}

export const PasswordsLive = Layer.effect(
  Passwords,
  Effect.gen(function* () {
    const config = (yield* RuntimeConfiguration).password;
    const options = { ...config, type: argon2id } as const;
    return Passwords.of({
      hash: Effect.fn('Passwords.hash')((password: string) =>
        Effect.tryPromise({
          try: async () => {
            return await hash(password, options);
          },
          catch: (cause) => new PasswordHashError({ cause }),
        }),
      ),
      verify: Effect.fn('Passwords.verify')((passwordHash: string, password: string) =>
        Effect.tryPromise({
          try: async () => {
            return await verify(passwordHash, password);
          },
          catch: () => false,
        }).pipe(Effect.catch(() => Effect.succeed(false))),
      ),
    });
  }),
);
