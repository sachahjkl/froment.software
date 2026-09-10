import { describe, expect, it } from 'vitest';
import { componentReferenceText } from '@froment/l10n/component-reference';
import { formatReferenceCount } from './reference-text';

describe('Reference translations', () => {
  it('keeps French and English keys aligned', () => {
    expect(Object.keys(componentReferenceText.fr).sort()).toEqual(
      Object.keys(componentReferenceText.en).sort(),
    );
    expect(Object.keys(componentReferenceText.fr.groups).sort()).toEqual(
      Object.keys(componentReferenceText.en.groups).sort(),
    );
    expect(Object.keys(componentReferenceText.fr.stories).sort()).toEqual(
      Object.keys(componentReferenceText.en.stories).sort(),
    );
    for (const id of [
      'back-office-header',
      'back-office-nav',
      'global-search',
      'document-issues',
      'mermaid-diagrams',
      'copy-notice',
    ]) {
      const french = componentReferenceText.fr.stories[id];
      const english = componentReferenceText.en.stories[id];
      expect(french.properties.map(([name]) => name)).toEqual(
        english.properties.map(([name]) => name),
      );
      expect(french.usage.trim()).not.toBe('');
      expect(english.usage.trim()).not.toBe('');
    }
  });

  it('uses locale plural rules for zero, one and multiple items', () => {
    const { fr, en } = componentReferenceText;
    expect(formatReferenceCount(0, 'fr', fr.componentCount)).toBe('0 composant');
    expect(formatReferenceCount(1, 'fr', fr.componentCount)).toBe('1 composant');
    expect(formatReferenceCount(2, 'fr', fr.componentCount)).toBe('2 composants');
    expect(formatReferenceCount(0, 'en', en.componentCount)).toBe('0 components');
    expect(formatReferenceCount(1, 'en', en.componentCount)).toBe('1 component');
    expect(formatReferenceCount(2, 'en', en.componentCount)).toBe('2 components');
    expect(formatReferenceCount(1, 'en', en.variantCount)).toBe('1 displayed variant');
    expect(formatReferenceCount(2, 'en', en.variantCount)).toBe('2 displayed variants');
    expect(formatReferenceCount(1, 'en', en.resultCount)).toBe('1 result');
    expect(formatReferenceCount(2, 'en', en.resultCount)).toBe('2 results');
  });
});
