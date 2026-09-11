import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { type QuoteRevisionValue } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { formatFixedDecimal } from '@backoffice/quote-input';
import { I18nService } from '@app/i18n.service';
import { DataTable } from '@shared/data-table/data-table';
import { DocumentTextView } from '@shared/document-text-view/document-text-view';

@Component({
  imports: [DataTable, DocumentTextView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-quote-lines',
  styleUrl: './quote-lines.scss',
  templateUrl: './quote-lines.html',
})
export class QuoteLines {
  readonly revision = input.required<QuoteRevisionValue>();
  protected readonly i18n = inject(I18nService);
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected decimal(value: number, digits: number): string {
    return formatFixedDecimal(value, digits, this.i18n.language() === 'fr' ? ',' : '.');
  }
}
