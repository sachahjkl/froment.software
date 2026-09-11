import { describe, expect, it } from 'vitest';
import { apiDocumentation } from './api-documentation.js';

describe('browser session documentation', () => {
  it.each(['fr', 'en'] as const)(
    'distinguishes API tokens from browser cookies in %s',
    (language) => {
      const bearer = apiDocumentation[language].security.bearer;
      expect(bearer).toContain('froment_api_v1_');
      expect(bearer).toContain('Bearer');
      expect(bearer).toContain('cookies');
    },
  );

  it.each([
    ['fr', 'mode d’accès', 'sans jeton secret'],
    ['en', 'access mode', 'without a secret token'],
  ] as const)('describes session renewal without a secret in %s', (language, mode, noSecret) => {
    const description = apiDocumentation[language].operations.refresh.description;
    expect(description).toContain('cookies');
    expect(description).toContain('expiration');
    expect(description).toContain(mode);
    expect(description).toContain(noSecret);
  });
});
