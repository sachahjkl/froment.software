export type Language = 'fr' | 'en';

export function isSupportedLanguage(language: string | null | undefined): language is Language {
  return language === 'fr' || language === 'en';
}
