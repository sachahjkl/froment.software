import type { Language } from './language.js';
import { translations } from './translations.js';

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

export function formatTranslation<Key extends ParameterizedTranslationKey>(
  language: Language,
  key: Key,
  params: TranslationParameters<Key>,
): string {
  let value: string = translate(language, key);
  for (const [param, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${param}}`, () => String(replacement));
  }
  return value;
}
