import { computed, inject } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { formatPluralText, type Language, type PluralForms } from '@froment/l10n';
// Gardez ce point d’entrée hors du dictionnaire global et des imports publics immédiats.
import { componentReferenceText } from '@froment/l10n/component-reference';

export function referenceText() {
  const i18n = inject(I18nService);
  return computed(() => componentReferenceText[i18n.language()]);
}

export function formatReferenceCount(
  count: number,
  language: Language,
  forms: PluralForms,
): string {
  return formatPluralText(language, forms, { count });
}
