import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SupplierInvoice } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';

import { Can } from '@backoffice/can';
import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { DataTable } from '@shared/data-table/data-table';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { WorkspaceTableTools } from '@shared/list-toolbar/workspace-table-tools';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { createWorkspaceTable, type WorkspaceTableOptions } from '../configuration/workspace-table';

const invoiceTableOptions: WorkspaceTableOptions<SupplierInvoice> = {
  columns: [
    { kind: 'text', key: 'date', value: (item) => item.invoiceDate },
    { kind: 'text', key: 'reference', value: (item) => item.reference },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.id,
  searchKeys: ['reference', 'supplierName', 'invoiceDate', 'dueDate'],
  parameters: { q: 'q', sort: 'sort', filter: 'status' },
  filters: [
    { value: 'draft', label: 'supplierInvoice.status.draft' },
    { value: 'confirmed', label: 'supplierInvoice.status.confirmed' },
    { value: 'approved', label: 'supplierInvoice.status.approved' },
    { value: 'paid', label: 'supplierInvoice.status.paid' },
    { value: 'cancelled', label: 'supplierInvoice.status.cancelled' },
  ],
  matchesFilter: (item, filter) => item.status === filter,
};

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-invoices',
  imports: [Can, DataTable, ListWorkspace, Notice, PageHeader, RouterLink, WorkspaceTableTools],
  templateUrl: './supplier-invoices.html',
  styleUrl: './supplier-invoices.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInvoicesPage {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SupplierInvoicesApi);
  protected readonly invoices = signal<ReadonlyArray<SupplierInvoice>>([]);
  protected readonly table = createWorkspaceTable(this.invoices, invoiceTableOptions);
  protected readonly invoiceExport = computed(() =>
    this.table
      .rows()
      .map((invoice) => [
        invoice.reference,
        invoice.supplierName,
        invoice.invoiceDate,
        invoice.dueDate,
        this.status(invoice),
        invoice.totalCents,
      ]),
  );
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
