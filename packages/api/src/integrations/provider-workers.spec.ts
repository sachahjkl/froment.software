import { Deferred, Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { expect, it } from 'vitest';
import { EmailTests, EmailTestWorkerLive } from './email-test-service.js';
import { Checkouts, CheckoutWorkerLive } from './checkout-service.js';

it('continues provider workers after defects and stops both when their scope closes', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      let emailPasses = 0;
      let checkoutPasses = 0;
      const emailRecovered = yield* Deferred.make<void>();
      const checkoutRecovered = yield* Deferred.make<void>();
      yield* Effect.gen(function* () {
        yield* Layer.build(
          EmailTestWorkerLive.pipe(
            Layer.provide(
              Layer.succeed(EmailTests, {
                enqueue: () => Effect.die('unused'),
                list: () => Effect.succeed([]),
                runPending: Effect.fn('EmailWorkerFake.pass')(function* () {
                  emailPasses++;
                  if (emailPasses === 1) return yield* Effect.die('private transport defect');
                  yield* Deferred.succeed(emailRecovered, undefined);
                }),
              }),
            ),
          ),
        );
        yield* Layer.build(
          CheckoutWorkerLive.pipe(
            Layer.provide(
              Layer.succeed(Checkouts, {
                connection: { credentialsPresent: false, testKey: false, webhookConfigured: false },
                enqueue: () => Effect.die('unused'),
                list: () => Effect.succeed([]),
                receiveEvent: () => Effect.void,
                runPending: Effect.fn('CheckoutWorkerFake.pass')(function* () {
                  checkoutPasses++;
                  if (checkoutPasses === 1) return yield* Effect.die('private transport defect');
                  yield* Deferred.succeed(checkoutRecovered, undefined);
                }),
              }),
            ),
          ),
        );
        yield* TestClock.adjust('3 seconds');
        yield* Deferred.await(emailRecovered);
        yield* Deferred.await(checkoutRecovered);
      }).pipe(Effect.scoped);
      const stopped = [emailPasses, checkoutPasses];
      yield* TestClock.adjust('1 minute');
      expect([emailPasses, checkoutPasses]).toEqual(stopped);
      expect(emailPasses).toBeGreaterThanOrEqual(2);
      expect(checkoutPasses).toBeGreaterThanOrEqual(2);
    }).pipe(Effect.provide(TestClock.layer())),
  );
});
