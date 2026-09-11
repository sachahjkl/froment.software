import { describe, expect, it } from 'vitest';
import { translations } from './translations.js';
import { translate, type TranslationKey } from './translation.js';

describe('error message translations', () => {
  it('keeps French and English keys aligned', () => {
    expect(Object.keys(translations.fr).sort()).toEqual(Object.keys(translations.en).sort());
  });

  it.each(['fr', 'en'] as const)('translates contextual messages in %s', (language) => {
    const keys = [
      'account.authenticationRequired',
      'account.password_unconfirmed',
      'account.sessions_load_error',
      'account.session_revoke_unconfirmed',
      'backOffice.apiTokens.loadError',
      'backOffice.apiTokens.createUnconfirmed',
      'backOffice.apiTokens.revokeUnconfirmed',
      'backOffice.apiTokens.createDenied',
      'passkey.loadError',
      'passkey.addUnconfirmed',
      'passkey.removeUnconfirmed',
      'team.loadError',
      'team.inviteUnconfirmed',
      'team.cancelUnconfirmed',
      'team.updateUnconfirmed',
      'team.joinUnconfirmed',
      'team.cancelRejected',
      'team.updateRejected',
      'team.inviteInvalid',
      'team.cancelDenied',
      'team.updateDenied',
      'credit.loadError',
      'ledger.loadError',
      'ledger.postUnconfirmed',
      'ledger.reverseUnconfirmed',
      'reminder.loadError',
      'reminder.scheduleUnconfirmed',
      'reminder.cancelUnconfirmed',
      'checkout.reconcileUnconfirmed',
      'audit.readDenied',
    ] satisfies ReadonlyArray<TranslationKey>;
    for (const key of keys) {
      expect(translate(language, key).trim(), key).not.toBe('');
      expect(translate(language, key), key).not.toMatch(/\b(could|might|would|should)\b/);
    }
  });

  it('does not turn authentication or request limits into inferred causes', () => {
    expect(translate('fr', 'authentication.required')).not.toMatch(/expir|jeton/);
    expect(translate('en', 'authentication.required')).not.toMatch(/expir|token/);
    expect(translate('fr', 'authentication.rate_limited')).not.toContain('échoué');
    expect(translate('en', 'authentication.rate_limited')).not.toContain('failed');
    expect(translate('fr', 'request.rate_limited')).not.toContain('modifications');
    expect(translate('en', 'request.rate_limited')).not.toContain('changes');
  });
});
