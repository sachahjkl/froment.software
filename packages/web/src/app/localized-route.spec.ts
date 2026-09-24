import { describe, expect, it } from 'vitest';
import { localizedPath, localizedUrl } from './localized-route';

describe('localized routes', () => {
  it('adds the language prefix to a public path', () => {
    expect(localizedPath('fr', '/')).toBe('/fr');
    expect(localizedPath('en', '/notes/slug')).toBe('/en/notes/slug');
  });

  it('replaces only the language prefix and preserves the rest of the URL', () => {
    expect(localizedUrl('/fr/notes/slug?source=feed#heading', 'en')).toBe(
      '/en/notes/slug?source=feed#heading',
    );
    expect(localizedUrl('/notes/slug', 'fr')).toBe('/fr/notes/slug');
  });
});
