import { describe, expect, it } from 'vitest';
import { checkoutReconcileErrorMessage } from './checkout-view';

describe('checkout verification messages', () => {
  it('names verification instead of creation when the result is unknown', () => {
    expect(checkoutReconcileErrorMessage('checkout.error')).toBe('checkout.reconcileUnconfirmed');
  });

  it('distinguishes the requester from the account that started the test', () => {
    expect(checkoutReconcileErrorMessage('authentication.permission_denied')).toBe(
      'checkout.reconcileDenied',
    );
    expect(checkoutReconcileErrorMessage('checkout.permissionRevoked')).toBe(
      'checkout.permissionRevoked',
    );
  });

  it('preserves specific errors and the absence of an error', () => {
    expect(checkoutReconcileErrorMessage('request.rate_limited')).toBe('request.rate_limited');
    expect(checkoutReconcileErrorMessage(undefined)).toBeUndefined();
  });
});
