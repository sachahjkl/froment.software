import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { Passwords, PasswordsLive } from './password.js';

describe('Passwords', () => {
  it('hashes with Argon2id and verifies only the matching password', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const passwords = yield* Passwords;
        const passwordHash = yield* passwords.hash('correct horse battery staple');
        return {
          passwordHash,
          accepted: yield* passwords.verify(passwordHash, 'correct horse battery staple'),
          rejected: yield* passwords.verify(passwordHash, 'wrong password'),
        };
      }).pipe(Effect.provide(PasswordsLive)),
    );

    expect(result.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(result.accepted).toBe(true);
    expect(result.rejected).toBe(false);
  }, 10_000);
});
