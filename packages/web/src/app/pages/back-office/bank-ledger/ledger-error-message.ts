import type { TranslationKey } from '@froment/l10n';

export function ledgerErrorMessage(
  code: TranslationKey | undefined,
  operation: 'load' | 'post' | 'reverse',
): TranslationKey | undefined {
  if (code !== 'ledger.error') return code;
  switch (operation) {
    case 'load':
      return 'ledger.loadError';
    case 'post':
      return 'ledger.postUnconfirmed';
    case 'reverse':
      return 'ledger.reverseUnconfirmed';
  }
}
