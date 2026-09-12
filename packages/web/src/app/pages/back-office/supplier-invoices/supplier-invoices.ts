import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SupplierInvoice } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';

import { Can } from '@backoffice/can';
import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-invoices',
  imports: [Can, DataTable, Notice, PageHeader, RouterLink],
  templateUrl: './supplier-invoices.html',
  styleUrl: './supplier-invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInvoicesPage {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SupplierInvoicesApi);
  protected readonly invoices = signal<ReadonlyArray<SupplierInvoice>>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  constructor() {
    afterNextRender(() => void this.load());
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.list();
      if (outcome.success) this.invoices.set(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.loading.set(false);
    }
  }
  protected money(invoice: SupplierInvoice): string {
    return formatMoney(invoice.totalCents, this.i18n.language(), invoice.currency);
  }
  protected status(invoice: SupplierInvoice): string {
    return this.i18n.t(`supplierInvoice.status.${invoice.status}`);
  }
}
