import { DOCUMENT } from '@angular/common';
import { afterNextRender, effect, inject, Injectable, signal } from '@angular/core';
import {
  formatTranslation,
  isSupportedLanguage,
  languages,
  translate,
  type Language,
  type ParameterizedTranslationKey,
  type TranslationParameters,
  type TranslationKey,
} from '@froment/l10n';

export type { Language, TranslationKey } from '@froment/l10n';

const storageKey = 'froment.software.language';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly document = inject(DOCUMENT);

  readonly language = signal<Language>('fr');
  readonly languages = languages;

  constructor() {
    afterNextRender(() => {
      const language = this.detectLanguage();
      this.language.set(language);
      this.writeStoredLanguage(language);
    });
    effect(() => {
      const language = this.language();
      this.document.documentElement.lang = language;
      this.document.documentElement.setAttribute('data-language', language);
    });
  }

  t(key: TranslationKey): string {
    return translate(this.language(), key);
  }

  tf<Key extends ParameterizedTranslationKey>(
    key: Key,
    params: TranslationParameters<Key>,
  ): string {
    return formatTranslation(this.language(), key, params);
  }

  setLanguage(language: string): void {
    if (isSupportedLanguage(language)) {
      this.language.set(language);
      this.writeStoredLanguage(language);
    }
  }

  private detectLanguage(): Language {
    const stored = this.readStoredLanguage();
    if (isSupportedLanguage(stored)) return stored;

    const browserLanguage = globalThis.navigator?.language?.toLowerCase() ?? 'fr';
    if (browserLanguage.startsWith('fr')) return 'fr';
    return 'en';
  }

  private readStoredLanguage(): string | null {
    try {
      return globalThis.localStorage?.getItem(storageKey) ?? null;
    } catch {
      return null;
    }
  }

  private writeStoredLanguage(language: Language): void {
    try {
      globalThis.localStorage?.setItem(storageKey, language);
    } catch {
      // Keep the in-memory language when browser storage is unavailable.
    }
  }
}
