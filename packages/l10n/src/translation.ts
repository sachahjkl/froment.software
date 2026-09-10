import type { Language } from './language.js';
import { translations } from './translations.js';
import { compileTranslationTemplate, renderTranslationTemplate } from './translation-template.js';

export type Translations = (typeof translations)[Language];
export type TranslationKey = keyof Translations;
export type TranslationDictionary = Record<TranslationKey, string>;

export const languages = [
  { code: 'fr', labelKey: 'lang.fr' },
  { code: 'en', labelKey: 'lang.en' },
] satisfies readonly { code: Language; labelKey: TranslationKey }[];

export function translate(language: Language, key: TranslationKey): string {
  return translations[language][key];
}

type TranslationParameter<Value extends string> =
  Value extends `${string}{${infer Parameter}}${infer Rest}`
    ? Parameter | TranslationParameter<Rest>
    : never;

export type ParameterizedTranslationKey = {
  [Key in TranslationKey]: TranslationParameter<Translations[Key]> extends never ? never : Key;
}[TranslationKey];

export type TranslationParameters<Key extends ParameterizedTranslationKey> = Readonly<
  Record<TranslationParameter<(typeof translations)['fr'][Key]>, string | number>
>;

export type PluralTranslationKey = {
  [Key in TranslationKey]: Key extends `${infer Base}.one`
    ? `${Base}.other` extends TranslationKey
      ? Base
      : never
    : never;
}[TranslationKey];

type PluralTranslationVariant<Key extends PluralTranslationKey> = Extract<
  `${Key}.one` | `${Key}.other`,
  TranslationKey
>;

type PluralParameters<Text extends string> = Readonly<
  { count: number } & Record<Exclude<TranslationParameter<Text>, 'count'>, string | number>
>;

export type PluralTranslationParameters<Key extends PluralTranslationKey> = PluralParameters<
  Translations[PluralTranslationVariant<Key>]
>;

export interface PluralForms {
  readonly one: string;
  readonly other: string;
}

const pluralRules = {
  fr: new Intl.PluralRules('fr'),
  en: new Intl.PluralRules('en'),
} satisfies Record<Language, Intl.PluralRules>;

const compiledTranslations = new Map<string, ReturnType<typeof compileTranslationTemplate>>();

export function translationParts(language: Language, key: ParameterizedTranslationKey) {
  return compiledTemplate(translate(language, key));
}

export function formatTranslation<Key extends ParameterizedTranslationKey>(
  language: Language,
  key: Key,
  params: TranslationParameters<Key>,
): string {
  return interpolateTranslation(translate(language, key), params);
}

export function formatPluralTranslation<Key extends PluralTranslationKey>(
  language: Language,
  key: Key,
  params: PluralTranslationParameters<Key>,
): string {
  const oneKey: `${Key}.one` = `${key}.one`;
  const otherKey: `${Key}.other` = `${key}.other`;
  return formatPluralText(
    language,
    {
      one: translate(language, oneKey),
      other: translate(language, otherKey),
    },
    params,
  );
}

export function formatPluralText<Forms extends PluralForms>(
  language: Language,
  forms: Forms,
  params: PluralParameters<Forms['one' | 'other']>,
): string {
  if (!Number.isSafeInteger(params.count) || params.count < 0) {
    throw new RangeError('Le compteur de traduction doit être un entier sûr positif ou nul.');
  }
  const variant = pluralRules[language].select(params.count) === 'one' ? 'one' : 'other';
  return interpolateTranslation(forms[variant], params);
}

function interpolateTranslation(
  value: string,
  params: Readonly<Record<string, string | number>>,
): string {
  return renderTranslationTemplate(compiledTemplate(value), params);
}

function compiledTemplate(value: string): ReturnType<typeof compileTranslationTemplate> {
  let template = compiledTranslations.get(value);
  if (template === undefined) {
    template = compileTranslationTemplate(value);
    compiledTranslations.set(value, template);
  }
  return template;
}
