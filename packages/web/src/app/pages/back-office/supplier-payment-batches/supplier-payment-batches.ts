import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SupplierInvoice, SupplierPaymentBatch } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';

import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-payment-batches',
  imports: [Breadcrumbs, Button, DataTable, Notice, PageHeader, RouterLink],
  templateUrl: './supplier-payment-batches.html',
  styleUrl: './supplier-payment-batches.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierPaymentBatchesPage {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SupplierInvoicesApi);
  protected readonly invoices = signal<ReadonlyArray<SupplierInvoice>>([]);
  protected readonly batches = signal<ReadonlyArray<SupplierPaymentBatch>>([]);
  protected readonly selectedIds = signal<ReadonlyArray<string>>([]);
  protected readonly executionDate = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly created = signal<SupplierPaymentBatch | undefined>(undefined);
  protected readonly eligibleInvoices = computed(() =>
    this.invoices().filter(
      (invoice) => invoice.status === 'approved' && invoice.currency === 'EUR',
    ),
  );
  protected readonly canCreate = computed(
    () => this.selectedIds().length > 0 && this.executionDate() !== '' && !this.busy(),
  );
  protected readonly breadcrumbs = computed(() => [
    { label: this.i18n.t('supplierInvoice.title'), path: '/backoffice/purchases' },
  ]);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }

  protected isSelected(invoiceId: string): boolean {
    return this.selectedIds().includes(invoiceId);
  }

  protected select(invoiceId: string, event: Event): void {
    const checked = event.target instanceof HTMLInputElement && event.target.checked;
    this.selectedIds.update((ids) =>
      checked ? [...ids, invoiceId] : ids.filter((current) => current !== invoiceId),
    );
    this.created.set(undefined);
  }

  protected setExecutionDate(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.executionDate.set(event.target.value);
    this.created.set(undefined);
  }

  protected async create(): Promise<void> {
    if (!this.canCreate()) return;
    this.busy.set(true);
    this.error.set(undefined);
    this.created.set(undefined);
    try {
      const outcome = await this.api.createPaymentBatch({
        requestId: crypto.randomUUID(),
        executionDate: this.executionDate(),
        invoiceIds: this.selectedIds(),
      });
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.created.set(outcome.result);
      this.batches.update((batches) => [outcome.result, ...batches]);
      this.selectedIds.set([]);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.busy.set(false);
    }
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const [invoices, batches] = await Promise.all([this.api.list(), this.api.paymentBatches()]);
      if (!invoices.success) this.error.set(invoices.code);
      else if (!batches.success) this.error.set(batches.code);
      else {
        this.invoices.set(invoices.result);
        this.batches.set(batches.result);
      }
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.loading.set(false);
    }
  }
}
