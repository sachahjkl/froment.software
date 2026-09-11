import { Clock, Effect } from 'effect';

interface RequestWindow {
  count: number;
  readonly expiresAt: number;
}

// Active counters must not be evicted to admit new keys.
export const make = Effect.fn('RequestQuota.make')(function* (options: {
  readonly capacity: number;
  readonly windowMillis: number;
}) {
  const clock = yield* Clock.Clock;
  const windows = new Map<string, RequestWindow>();

  return (keys: ReadonlyArray<string>, limit: number) =>
    Effect.sync(() => {
      const now = clock.currentTimeMillisUnsafe();
      // Fixed windows retain insertion order until expiry.
      for (const [key, window] of windows) {
        if (window.expiresAt > now) break;
        windows.delete(key);
      }
      const uniqueKeys = new Set(keys);
      let newKeys = 0;
      for (const key of uniqueKeys) {
        const window = windows.get(key);
        if (window === undefined) newKeys += 1;
        else if (window.count >= limit) return false;
      }
      if (windows.size + newKeys > options.capacity) return false;
      for (const key of uniqueKeys) {
        const window = windows.get(key);
        if (window === undefined) {
          windows.set(key, { count: 1, expiresAt: now + options.windowMillis });
        } else {
          window.count += 1;
        }
      }
      return true;
    });
});
