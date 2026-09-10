import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  formatPluralTranslation,
  formatPluralText,
  formatTranslation,
  translationParts,
  type PluralTranslationKey,
  type PluralTranslationParameters,
  type TranslationParameters,
} from './translation.js';

describe('translation parts', () => {
  it.each([
    ['fr', 'Devis pour '],
    ['en', 'Quote for '],
  ] as const)('keeps the client placeholder separate in %s', (language, prefix) => {
    const parts = translationParts(language, 'commercialHeader.quoteDescription');
    expect(parts).toEqual([
      { kind: 'text', value: prefix },
      { kind: 'parameter', name: 'client' },
      { kind: 'text', value: '.' },
    ]);
    expect(translationParts(language, 'commercialHeader.quoteDescription')).toBe(parts);
    expect(
      formatTranslation(language, 'commercialHeader.quoteDescription', { client: '{client}' }),
    ).toBe(`${prefix}{client}.`);
  });
});

describe('plural translations', () => {
  it('uses the same rules and literal renderer for a deferred dictionary', () => {
    const forms = {
      one: '{count} composant pour {name}',
      other: '{count} composants pour {name}',
    } as const;
    expect(formatPluralText('fr', forms, { count: 1, name: '{count}' })).toBe(
      '1 composant pour {count}',
    );
    expect(formatPluralText('fr', forms, { count: 2, name: 'Atlas' })).toBe(
      '2 composants pour Atlas',
    );
    expect(() => formatPluralText('fr', forms, { count: -1, name: 'Atlas' })).toThrow(RangeError);
    // @ts-expect-error Le dictionnaire différé exige aussi le paramètre name.
    formatPluralText('fr', forms, { count: 1 });
  });
  it.each([
    ['fr', 0, '0 résultat'],
    ['fr', 1, '1 résultat'],
    ['fr', 2, '2 résultats'],
    ['fr', 1_000_000, '1000000 résultats'],
    ['en', 0, '0 results'],
    ['en', 1, '1 result'],
    ['en', 2, '2 results'],
    ['en', 1_000_000, '1000000 results'],
  ] as const)('formats %s with count %i', (language, count, expected) => {
    expect(formatPluralTranslation(language, 'listControls.optionCount', { count })).toBe(expected);
  });

  it('accepts the maximum safe integer without rounding it', () => {
    expect(
      formatPluralTranslation('en', 'listControls.optionCount', { count: Number.MAX_SAFE_INTEGER }),
    ).toBe('9007199254740991 results');
  });

  it.each([-1, -0.5, 0.5, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects the invalid counter %s',
    (count) => {
      expect(() => formatPluralTranslation('fr', 'listControls.optionCount', { count })).toThrow(
        new RangeError('Le compteur de traduction doit être un entier sûr positif ou nul.'),
      );
    },
  );

  it('requires a numeric count at the type boundary', () => {
    expectTypeOf<PluralTranslationParameters<'listControls.optionCount'>>().toEqualTypeOf<{
      readonly count: number;
    }>();
    expect(() => {
      // @ts-expect-error Le compteur doit être un nombre.
      formatPluralTranslation('fr', 'listControls.optionCount', { count: '2' });
    }).toThrow(RangeError);
    expect(() => {
      // @ts-expect-error Le compteur est obligatoire.
      formatPluralTranslation('fr', 'listControls.optionCount', {});
    }).toThrow(RangeError);
  });

  it('accepts only base keys that have both variants', () => {
    expectTypeOf<'listControls.optionCount'>().toExtend<PluralTranslationKey>();
    expectTypeOf<Extract<PluralTranslationKey, 'listControls.optionCount.one'>>().toBeNever();
    expectTypeOf<Extract<PluralTranslationKey, 'payment'>>().toBeNever();
    expectTypeOf<Extract<PluralTranslationKey, 'nav.home'>>().toBeNever();
  });

  it('infers and requires the additional parameters of the plural variants', () => {
    expectTypeOf<
      PluralTranslationParameters<'configurationWorkspace.tokenConfirm'>
    >().toEqualTypeOf<{
      readonly count: number;
      readonly name: string | number;
    }>();
    // @ts-expect-error Le nom reste obligatoire avec le compteur.
    formatPluralTranslation('fr', 'configurationWorkspace.tokenConfirm', { count: 2 });
  });

  it.each(['<script>alert(1)</script>', '<img src=x onerror="alert(1)">', '$&', '$`', "$'", '$$'])(
    'keeps the additional plural parameter %s literal',
    (name) => {
      expect(
        formatPluralTranslation('en', 'configurationWorkspace.tokenConfirm', { count: 1, name }),
      ).toBe(`Create the token “${name}” with 1 permission?`);
      expect(
        formatPluralTranslation('fr', 'configurationWorkspace.tokenConfirm', { count: 2, name }),
      ).toBe(`Créer le jeton « ${name} » avec 2 permissions ?`);
    },
  );
});

describe('shared translation interpolation', () => {
  it('does not interpret placeholders inside a parameter value', () => {
    expect(
      formatPluralTranslation('en', 'configurationWorkspace.tokenConfirm', {
        name: '{count}',
        count: 1,
      }),
    ).toBe('Create the token “{count}” with 1 permission?');
    expect(
      formatTranslation('fr', 'backOffice.clientDetail.passwordRequirements', {
        min: '{max}',
        max: 64,
      }),
    ).toBe('Utilisez entre {max} et 64 caractères.');
  });
  it('keeps existing parameter inference and multiple replacements', () => {
    expectTypeOf<
      TranslationParameters<'backOffice.clientDetail.passwordRequirements'>
    >().toEqualTypeOf<{
      readonly min: string | number;
      readonly max: string | number;
    }>();
    expect(
      formatTranslation('fr', 'backOffice.clientDetail.passwordRequirements', { min: 12, max: 64 }),
    ).toBe('Utilisez entre 12 et 64 caractères.');
  });

  it.each(['<script>alert(1)</script>', '<img src=x onerror="alert(1)">', '$&', '$`', "$'", '$$'])(
    'preserves the literal parameter %s',
    (client) => {
      expect(formatTranslation('en', 'backOffice.clients.accessReady', { client })).toBe(
        `Sign-in identifier created for ${client}`,
      );
    },
  );
});
