import { describe, expect, it } from 'vitest';
import { accountErrorMessage, passkeyErrorMessage } from './account-error-message';

describe('account error messages', () => {
  it.each([
    ['password', 'account.password_unconfirmed'],
    ['load-sessions', 'account.sessions_load_error'],
    ['revoke-session', 'account.session_revoke_unconfirmed'],
  ] as const)('names the %s operation without changing the failure code', (operation, message) => {
    expect(accountErrorMessage('authentication.error', operation)).toBe(message);
    expect(accountErrorMessage('authentication.required', operation)).toBe(
      'account.authenticationRequired',
    );
    expect(accountErrorMessage('request.rate_limited', operation)).toBe('request.rate_limited');
    expect(accountErrorMessage(undefined, operation)).toBeUndefined();
  });

  it.each([
    ['load', 'passkey.loadError'],
    ['add', 'passkey.addUnconfirmed'],
    ['remove', 'passkey.removeUnconfirmed'],
  ] as const)('distinguishes passkey %s from sign-in', (operation, message) => {
    expect(passkeyErrorMessage('passkey.error', operation)).toBe(message);
    expect(passkeyErrorMessage('passkey.rejected', operation)).toBe('passkey.rejected');
    expect(passkeyErrorMessage('authentication.required', operation)).toBe(
      'account.authenticationRequired',
    );
    expect(passkeyErrorMessage(undefined, operation)).toBeUndefined();
  });

  it('preserves a confirmed password refusal', () => {
    expect(accountErrorMessage('authentication.password_change_rejected', 'password')).toBe(
      'authentication.password_change_rejected',
    );
  });
});
