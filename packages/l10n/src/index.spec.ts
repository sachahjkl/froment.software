import { describe, expect, it } from 'vitest';

import { formatTranslation, isSupportedLanguage, translate } from './index.js';

describe('localization', () => {
  it('translates a key without a platform dependency', () => {
    expect(translate('fr', 'nav.home')).toBe('Accueil');
    expect(translate('en', 'nav.home')).toBe('Home');
  });

  it('formats parameters', () => {
    expect(formatTranslation('en', 'backOffice.clients.accessReady', { client: 'Acme' })).toBe(
      'Sign-in identifier created for Acme',
    );
  });

  it.each(['$&', '$`', "$'", '$$'])('preserves the literal replacement %s', (client) => {
    expect(formatTranslation('en', 'backOffice.clients.accessReady', { client })).toBe(
      `Sign-in identifier created for ${client}`,
    );
  });

  it('requires the parameters declared by the translation key', () => {
    // @ts-expect-error The client parameter is required.
    formatTranslation('en', 'backOffice.clients.accessReady', {});
    // @ts-expect-error A translation without parameters cannot be formatted.
    formatTranslation('en', 'nav.home', {});
  });

  it('validates supported languages', () => {
    expect(isSupportedLanguage('fr')).toBe(true);
    expect(isSupportedLanguage('de')).toBe(false);
  });
});
