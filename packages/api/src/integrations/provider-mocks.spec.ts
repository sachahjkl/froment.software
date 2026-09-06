import { Effect, Schema } from 'effect';
import { expect, it } from 'vitest';
import { PaymentActions } from '@froment/contracts';
import { PaymentProvider, SimulatedProviders, SignatureProvider } from './providers.js';

it('keeps mock commands independent and isolates preview objects between calls', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const payments = yield* PaymentProvider;
      const request = {
        providerId: 'any-provider-id',
        requestId: '91ff5717-c394-4708-bef2-6b5f5cafbdaa',
      };
      const before = yield* payments.get(request);
      const cancelled = yield* payments.cancel({ ...request, reason: 'test' });
      expect(cancelled).toMatchObject({
        mode: 'simulation',
        executed: false,
        preview: { status: 'cancelled' },
      });
      expect(yield* payments.get(request)).toEqual(before);
      if (before.mode === 'simulation') Reflect.set(before.preview, 'status', 'failed');
      const fresh = yield* payments.get(request);
      expect(Schema.is(PaymentActions.get.response)(fresh)).toBe(true);
      expect(fresh).toMatchObject({ preview: { status: 'pending' } });
      const signatures = yield* SignatureProvider;
      expect(yield* signatures.proof(request)).toMatchObject({ preview: { available: false } });
    }).pipe(Effect.provide(SimulatedProviders)),
  );
});
