import { computed, inject } from '@angular/core';
import { I18nService } from '@app/i18n.service';
// Cet import reste dans les chunks de la référence. Ne l’ajoutez pas au dictionnaire global.
import {
  componentReferenceText,
  formatPluralText,
  type Language,
  type PluralForms,
} from '@froment/l10n';

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
