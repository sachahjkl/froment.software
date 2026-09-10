import { describe, expect, it } from 'vitest';
import { clientExperienceText } from './client-experience.js';

describe('client experience translations', () => {
  it('provides both count variants and retains the display limit in each search variant', () => {
    for (const language of ['fr', 'en'] as const) {
      const text = clientExperienceText[language];
      expect(Object.keys(text)).not.toContain('portalWorkspace.count');
      expect(Object.keys(text)).not.toContain('globalSearch.count');
      expect(text['portalWorkspace.count.one']).toBe('{count} document');
      expect(text['portalWorkspace.count.other']).toBe('{count} documents');
      for (const variant of ['one', 'other'] as const) {
        const search = text[`globalSearch.count.${variant}`];
        expect(search.match(/\{\w+\}/g)).toEqual(['{count}']);
        expect(search).toContain(language === 'fr' ? '5 par catégorie.' : '5 per category.');
      }
    }
  });

  it('uses the same keys and parameters in French and English', () => {
    expect(Object.keys(clientExperienceText.fr).sort()).toEqual(
      Object.keys(clientExperienceText.en).sort(),
    );
    for (const key of Object.keys(
      clientExperienceText.fr,
    ) as (keyof typeof clientExperienceText.fr)[]) {
      expect(clientExperienceText.fr[key].match(/\{\w+\}/g) ?? []).toEqual(
        clientExperienceText.en[key].match(/\{\w+\}/g) ?? [],
      );
    }
  });
});
