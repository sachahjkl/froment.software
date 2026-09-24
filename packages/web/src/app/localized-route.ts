import { isSupportedLanguage, type Language } from '@froment/l10n';

export function localizedPath(language: Language, path: string): string {
  const normalizedPath = path === '/' ? '' : path.replace(/^\/+/, '');
  return normalizedPath ? `/${language}/${normalizedPath}` : `/${language}`;
}

export function localizedUrl(url: string, language: Language): string {
  const suffixIndex = url.search(/[?#]/);
  const path = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : url.slice(suffixIndex);
  const normalizedPath = path === '/' ? '' : path.replace(/^\/+/, '');
  const segments = normalizedPath ? normalizedPath.split('/') : [];

  if (isSupportedLanguage(segments[0])) {
    segments[0] = language;
  } else {
    segments.unshift(language);
  }

  return `/${segments.join('/')}${suffix}`;
}
