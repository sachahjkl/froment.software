import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type InvoiceListValue, type InvoiceStatusValue } from '@froment/contracts';

import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';

type PageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-invoices',
  imports: [Badge, Button, DataTable, Notice, RouterLink],
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invoices {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  protected readonly state = signal<PageState>('loading');
  protected readonly invoices = signal<InvoiceListValue>([]);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected statusLabel(status: InvoiceStatusValue): string {
    return this.i18n.t(`backOffice.invoice.status.${status}`);
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.invoices.set(await this.api.list());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
