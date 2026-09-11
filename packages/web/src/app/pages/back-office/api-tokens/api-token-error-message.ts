import type { TranslationKey } from '@froment/l10n';

export type ApiTokenOperation = 'load' | 'create' | 'revoke';

export function apiTokenErrorMessage(
  code: TranslationKey | undefined,
  operation: ApiTokenOperation,
): TranslationKey | undefined {
  if (code === 'authentication.permission_denied' && operation === 'create') {
    return 'backOffice.apiTokens.createDenied';
  }
  if (code !== 'api_token.error') return code;
  const messages = {
    load: 'backOffice.apiTokens.loadError',
    create: 'backOffice.apiTokens.createUnconfirmed',
    revoke: 'backOffice.apiTokens.revokeUnconfirmed',
  } satisfies Record<ApiTokenOperation, TranslationKey>;
  return messages[operation];
}
