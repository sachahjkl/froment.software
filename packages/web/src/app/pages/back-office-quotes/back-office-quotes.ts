import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type QuoteListValue } from '@froment/contracts';

import { BackOfficeQuotesApi } from '../../back-office/back-office-quotes-api';
import { I18nService } from '../../i18n.service';
import { Button } from '../../shared/button/button';

type PageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-back-office-quotes',
  imports: [Button, RouterLink],
  templateUrl: './back-office-quotes.html',
  styleUrl: './back-office-quotes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeQuotes {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BackOfficeQuotesApi);
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

  private async load(): Promise<void> {
    try {
      this.quotes.set(await this.api.list());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
