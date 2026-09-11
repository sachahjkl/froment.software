import { describe, expect, it } from 'vitest';
import { apiTokenErrorMessage } from './api-token-error-message';

describe('API token error messages', () => {
  it.each([
    ['load', 'backOffice.apiTokens.loadError'],
    ['create', 'backOffice.apiTokens.createUnconfirmed'],
    ['revoke', 'backOffice.apiTokens.revokeUnconfirmed'],
  ] as const)('names the %s operation', (operation, message) => {
    expect(apiTokenErrorMessage('api_token.error', operation)).toBe(message);
    expect(apiTokenErrorMessage('api_token.name_conflict', operation)).toBe(
      'api_token.name_conflict',
    );
    expect(apiTokenErrorMessage(undefined, operation)).toBeUndefined();
  });

  it('describes selected permissions only when creating a token', () => {
    expect(apiTokenErrorMessage('authentication.permission_denied', 'create')).toBe(
      'backOffice.apiTokens.createDenied',
    );
    expect(apiTokenErrorMessage('authentication.permission_denied', 'revoke')).toBe(
      'authentication.permission_denied',
    );
  });
});
