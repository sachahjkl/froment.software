import { describe, expect, it } from 'vitest';
import { formatTranslation } from './index.js';

describe('Configuration plural translations', () => {
  it.each([
    {
      language: 'fr',
      count: 0,
      variant: 'one',
      permission: 'permission',
      event: 'événement',
      displayed: 'affiché',
      loaded: 'chargé',
    },
    {
      language: 'fr',
      count: 1,
      variant: 'one',
      permission: 'permission',
      event: 'événement',
      displayed: 'affiché',
      loaded: 'chargé',
    },
    {
      language: 'fr',
      count: 2,
      variant: 'other',
      permission: 'permissions',
      event: 'événements',
      displayed: 'affichés',
      loaded: 'chargés',
    },
    {
      language: 'en',
      count: 0,
      variant: 'other',
      permission: 'permissions',
      event: 'events',
      displayed: 'displayed',
      loaded: 'loaded',
    },
    {
      language: 'en',
      count: 1,
      variant: 'one',
      permission: 'permission',
      event: 'event',
      displayed: 'displayed',
      loaded: 'loaded',
    },
    {
      language: 'en',
      count: 2,
      variant: 'other',
      permission: 'permissions',
      event: 'events',
      displayed: 'displayed',
      loaded: 'loaded',
    },
  ] as const)(
    'formats the $variant variant for $count in $language',
    ({ language, count, variant, permission, event, displayed, loaded }) => {
      expect(
        formatTranslation(language, `configurationWorkspace.permissionCount.${variant}`, { count }),
      ).toBe(`${count} ${permission}`);
      expect(formatTranslation(language, `audit.count.${variant}`, { count })).toBe(
        `${count} ${event} ${language === 'fr' ? 'sur cette page' : 'on this page'}`,
      );
      expect(formatTranslation(language, `audit.visibleCount.${variant}`, { count })).toBe(
        `${count} ${event} ${displayed}`,
      );
      expect(formatTranslation(language, `audit.loadedCount.${variant}`, { count })).toBe(
        language === 'fr'
          ? `sur ${count} ${event} ${loaded}.`
          : `from ${count} ${loaded} ${event}.`,
      );
      expect(
        formatTranslation(language, `configurationWorkspace.tokenConfirm.${variant}`, {
          name: 'ERP',
          count,
        }),
      ).toBe(
        language === 'fr'
          ? `Créer le jeton « ERP » avec ${count} ${permission} ?`
          : `Create the token “ERP” with ${count} ${permission}?`,
      );
    },
  );
});
