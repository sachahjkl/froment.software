import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { translationParts, type ParameterizedTranslationKey } from '@froment/l10n';
import { I18nService } from '@app/i18n.service';

export const clientDescriptionKeys = {
  quote: 'commercialHeader.quoteDescription',
  order: 'commercialHeader.orderDescription',
  invoice: 'commercialHeader.invoiceDescription',
  affair: 'commercialHeader.affairDescription',
} as const satisfies Record<string, ParameterizedTranslationKey>;

@Component({
  imports: [RouterLink],
  selector: 'p[appClientDescription]',
  templateUrl: './client-description.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDescription {
  private readonly i18n = inject(I18nService);
  readonly kind = input.required<keyof typeof clientDescriptionKeys>();
  readonly clientId = input.required<string>();
  readonly clientName = input.required<string>();
  protected readonly parts = computed(() =>
    translationParts(this.i18n.language(), clientDescriptionKeys[this.kind()]),
  );
}
