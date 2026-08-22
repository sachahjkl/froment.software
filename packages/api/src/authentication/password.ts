import { argon2idAsync } from '@noble/hashes/argon2.js';
import { Context, Effect, Layer, Schema } from 'effect';
import { randomBytes, timingSafeEqual } from 'node:crypto';

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
  m: 19_456,
  t: 2,
  p: 1,
  dkLen: 32,
} as const;

const derive = (password: string, salt: Uint8Array) => argon2idAsync(password, salt, options);

export const PasswordsLive = Layer.succeed(
  Passwords,
  Passwords.of({
    hash: Effect.fn('Passwords.hash')((password: string) =>
      Effect.tryPromise({
        try: async () => {
          const salt = randomBytes(16);
          const digest = await derive(password, salt);
          return `$argon2id$v=19$m=${options.m},t=${options.t},p=${options.p}$${salt.toString('base64url')}$${Buffer.from(digest).toString('base64url')}`;
        },
        catch: (cause) => new PasswordHashError({ cause }),
      }),
    ),
    verify: Effect.fn('Passwords.verify')((passwordHash: string, password: string) =>
      Effect.tryPromise({
        try: async () => {
          const match =
            /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/.exec(
              passwordHash,
            );
          if (match === null) return false;
          const salt = Buffer.from(match[1], 'base64url');
          const expected = Buffer.from(match[2], 'base64url');
          const actual = Buffer.from(await derive(password, salt));
          return timingSafeEqual(actual, expected);
        },
        catch: () => false,
      }).pipe(Effect.catch(() => Effect.succeed(false))),
    ),
  }),
);
