import { isSupportedLanguage, languages, type Language } from '@froment/l10n';
import Negotiator from 'negotiator';

export const requestLanguage = (acceptLanguage: string | undefined): Language => {
  const language = new Negotiator({ headers: { 'accept-language': acceptLanguage } }).language(
    languages.map((language) => language.code),
  );
  return isSupportedLanguage(language) ? language : 'fr';
};
