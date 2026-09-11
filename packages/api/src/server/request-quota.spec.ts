import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { expect, it } from 'vitest';

import * as RequestQuota from './request-quota.js';

it('reserves all keys atomically under concurrency without partial consumption', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const reserve = yield* RequestQuota.make({ capacity: 4, windowMillis: 60_000 });
      const results = yield* Effect.all(
        Array.from({ length: 20 }, () => reserve(['address', 'account'], 2)),
        { concurrency: 'unbounded' },
      );
      expect(results.filter(Boolean)).toHaveLength(2);
      expect(yield* reserve(['other-address', 'account'], 2)).toBe(false);
      expect(yield* reserve(['other-address'], 1)).toBe(true);
      expect(yield* reserve(['extra', 'overflow'], 1)).toBe(false);
      expect(yield* reserve(['extra'], 1)).toBe(true);
      yield* TestClock.adjust('1 minute');
      expect(yield* reserve(['address', 'account'], 2)).toBe(true);
    }).pipe(Effect.provide(TestClock.layer())),
  );
});
