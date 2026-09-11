import { describe, expect, it } from 'vitest';
import { ledgerErrorMessage } from './ledger-error-message';

describe('ledger error messages', () => {
  it.each([
    ['load', 'ledger.loadError'],
    ['post', 'ledger.postUnconfirmed'],
    ['reverse', 'ledger.reverseUnconfirmed'],
  ] as const)('names the %s operation', (operation, message) => {
    expect(ledgerErrorMessage('ledger.error', operation)).toBe(message);
    expect(ledgerErrorMessage('ledger.conflict', operation)).toBe('ledger.conflict');
    expect(ledgerErrorMessage('authentication.permission_denied', operation)).toBe(
      'authentication.permission_denied',
    );
    expect(ledgerErrorMessage(undefined, operation)).toBeUndefined();
  });
});
