import { describe, expect, it } from 'vitest';
import { compileTranslationTemplate, renderTranslationTemplate } from './translation-template.js';

describe('translation templates', () => {
  it('compiles text and named parameters into separate nodes', () => {
    expect(compileTranslationTemplate('Bonjour {name}, {count} résultats.')).toEqual([
      { kind: 'text', value: 'Bonjour ' },
      { kind: 'parameter', name: 'name' },
      { kind: 'text', value: ', ' },
      { kind: 'parameter', name: 'count' },
      { kind: 'text', value: ' résultats.' },
    ]);
  });

  it.each([
    '',
    'Texte sans paramètre.',
    "L'option d’aujourd’hui",
    '{}',
    '{',
    '}',
    '{name',
    'name}',
  ])('preserves literal text %s', (source) => {
    expect(renderTranslationTemplate(compileTranslationTemplate(source), {})).toBe(source);
  });

  it('renders adjacent and repeated parameters without interpreting their values', () => {
    const template = compileTranslationTemplate('{name}{count} / {name}');
    expect(renderTranslationTemplate(template, { name: '{count}', count: 2 })).toBe(
      '{count}2 / {count}',
    );
    expect(renderTranslationTemplate(template, { name: '<b>$&</b>', count: 0 })).toBe(
      '<b>$&</b>0 / <b>$&</b>',
    );
  });

  it('preserves enclosing braces and unknown parameters', () => {
    const template = compileTranslationTemplate('{{name}} {missing} {a{}b}');
    expect(renderTranslationTemplate(template, { name: 'Atlas' })).toBe('{Atlas} {missing} {a{}b}');
  });

  it('ignores inherited properties', () => {
    const template = compileTranslationTemplate('{toString} {constructor}');
    expect(renderTranslationTemplate(template, {})).toBe('{toString} {constructor}');
  });
});
