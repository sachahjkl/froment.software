import { Directive, inject, input } from '@angular/core';
import { I18nService } from '@app/i18n.service';

@Directive({
  selector: '[appDataTable]',
  host: {
    class: 'data-table',
    '[attr.data-table-layout]': 'tableLayout()',
    role: 'region',
    tabindex: '0',
    '[attr.aria-label]': "i18n.t('table.scrollRegion')",
  },
})
export class DataTable {
  readonly tableLayout = input<'scroll' | 'fluid'>('scroll');
  protected readonly i18n = inject(I18nService);
}
