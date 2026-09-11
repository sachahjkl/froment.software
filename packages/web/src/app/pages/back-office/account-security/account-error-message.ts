import type { TranslationKey } from '@froment/l10n';

export type AccountOperation = 'password' | 'load-sessions' | 'revoke-session';
export type PasskeyOperation = 'load' | 'add' | 'remove';

export function accountErrorMessage(
  code: TranslationKey | undefined,
  operation: AccountOperation,
): TranslationKey | undefined {
  if (code === 'authentication.required') return 'account.authenticationRequired';
  if (code !== 'authentication.error') return code;
  const messages = {
    password: 'account.password_unconfirmed',
    'load-sessions': 'account.sessions_load_error',
    'revoke-session': 'account.session_revoke_unconfirmed',
  } satisfies Record<AccountOperation, TranslationKey>;
  return messages[operation];
}

export function passkeyErrorMessage(
  code: TranslationKey | undefined,
  operation: PasskeyOperation,
): TranslationKey | undefined {
  if (code === 'authentication.required') return 'account.authenticationRequired';
  if (code !== 'passkey.error') return code;
  const messages = {
    load: 'passkey.loadError',
    add: 'passkey.addUnconfirmed',
    remove: 'passkey.removeUnconfirmed',
  } satisfies Record<PasskeyOperation, TranslationKey>;
  return messages[operation];
}
