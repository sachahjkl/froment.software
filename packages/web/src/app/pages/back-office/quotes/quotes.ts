import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type QuoteListValue, type QuoteStatusValue } from '@froment/contracts';

import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';

type PageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-quotes',
  imports: [DataTable, Button, RouterLink],
  templateUrl: './quotes.html',
  styleUrl: './quotes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Quotes {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(QuotesApi);
  protected readonly state = signal<PageState>('loading');
  protected readonly quotes = signal<QuoteListValue>([]);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected statusLabel(status: QuoteStatusValue): string {
    return this.i18n.t(`backOffice.quote.status.${status}`);
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.quotes.set(await this.api.list());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
