import { hash, verify } from '@node-rs/argon2';
import { Context, Effect, Layer, Schema } from 'effect';

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

const options = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export const PasswordsLive = Layer.succeed(
  Passwords,
  Passwords.of({
    hash: Effect.fn('Passwords.hash')((password: string) =>
      Effect.tryPromise({
        try: () => hash(password, options),
        catch: (cause) => new PasswordHashError({ cause }),
      }),
    ),
    verify: Effect.fn('Passwords.verify')((passwordHash: string, password: string) =>
      Effect.tryPromise({
        try: () => verify(passwordHash, password, options),
        catch: () => false,
      }).pipe(Effect.catch(() => Effect.succeed(false))),
    ),
  }),
);
