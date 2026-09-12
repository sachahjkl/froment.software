import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BasisPointsPerPercent,
  type SupplierInvoice,
  type SupplierInvoiceEvidence,
} from '@froment/contracts';
import { formatMoney } from '@froment/l10n';

import { Can } from '@backoffice/can';
import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-invoice-detail',
  imports: [Breadcrumbs, Button, Can, DataTable, Notice, PageHeader, RouterLink],
  templateUrl: './supplier-invoice-detail.html',
  styleUrl: './supplier-invoice-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInvoiceDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SupplierInvoicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(Confirmation);
  protected readonly invoice = signal<SupplierInvoice | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly evidence = signal<ReadonlyArray<SupplierInvoiceEvidence>>([]);
  protected readonly editable = computed(() => this.invoice()?.status === 'draft');
  protected readonly canConfirm = computed(() => this.invoice()?.status === 'draft');
  protected readonly canApprove = computed(() => this.invoice()?.status === 'confirmed');
  protected readonly canCancel = computed(() =>
    ['draft', 'confirmed'].includes(this.invoice()?.status ?? ''),
  );
  protected readonly canCreateCredit = computed(() => {
    const invoice = this.invoice();
    if (invoice === undefined || invoice.documentKind !== 'invoice') return false;
    return ['confirmed', 'approved', 'paid'].includes(invoice.status);
  });
  protected readonly breadcrumbs = computed(() => [
    { label: this.i18n.t('supplierInvoice.title'), path: '/backoffice/purchases' },
  ]);
  constructor() {
    afterNextRender(() => void this.load());
  }
  protected async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('invoiceId');
    if (!id) return;
    try {
      const [outcome, evidence] = await Promise.all([this.api.get(id), this.api.evidence(id)]);
      if (outcome.success) this.invoice.set(outcome.result);
      else this.error.set(outcome.code);
      if (evidence.success) this.evidence.set(evidence.result);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.loading.set(false);
    }
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), this.invoice()?.currency ?? 'EUR');
  }
  protected status(): string {
    const status = this.invoice()?.status;
    return status ? this.i18n.t(`supplierInvoice.status.${status}`) : '';
  }
  protected source(): string {
    const source = this.invoice()?.source;
    return source ? this.i18n.t(`supplierInvoice.source.${source}`) : '';
  }
  protected documentKind(): TranslationKey {
    if (this.invoice()?.documentKind === 'credit') return 'supplierInvoice.kind.credit';
    return 'supplierInvoice.kind.invoice';
  }
  protected taxTreatment(): TranslationKey {
    const treatment = this.invoice()?.taxTreatment;
    if (treatment === 'eu-reverse-charge') return 'supplier.taxTreatment.eu';
    if (treatment === 'non-eu-import') return 'supplier.taxTreatment.import';
    if (treatment === 'foreign-local-tax') return 'supplier.taxTreatment.local';
    return 'supplier.taxTreatment.france';
  }
  protected vatRate(basisPoints: number): number {
    return basisPoints / BasisPointsPerPercent;
  }
  protected async transition(action: 'confirm' | 'approve' | 'cancel'): Promise<void> {
    const invoice = this.invoice();
    if (!invoice || this.busy()) return;
    if (!(await this.confirmation.request(this.i18n.t(`supplierInvoice.confirm.${action}`))))
      return;
    this.busy.set(true);
    try {
      const outcome = await this.api.transition(invoice.id, action, invoice.version);
      if (outcome.success) this.invoice.set(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.busy.set(false);
    }
  }
  protected async createCredit(): Promise<void> {
    const invoice = this.invoice();
    if (invoice === undefined || this.busy()) return;
    this.busy.set(true);
    try {
      const outcome = await this.api.createCredit({
        requestId: crypto.randomUUID(),
        sourceInvoiceId: invoice.id,
      });
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      await this.router.navigate(['/backoffice/purchases', outcome.result.id, 'edit']);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.busy.set(false);
    }
  }
  protected async addEvidence(event: Event): Promise<void> {
    const invoice = this.invoice();
    if (!(event.target instanceof HTMLInputElement)) return;
    const input = event.target;
    const file = input.files?.[0];
    if (invoice === undefined || file === undefined || this.busy()) return;
    this.busy.set(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const contentBase64 = dataUrl.split(',')[1] ?? '';
      const outcome = await this.api.createEvidence({
        invoiceId: invoice.id,
        fileName: file.name,
        mediaType: file.type || 'application/octet-stream',
        contentBase64,
      });
      if (!outcome.success) this.error.set(outcome.code);
      else this.evidence.update((items) => [outcome.result, ...items]);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      input.value = '';
      this.busy.set(false);
    }
  }
  protected async downloadEvidence(item: SupplierInvoiceEvidence): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const content = await this.api.downloadEvidence(item.id);
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.busy.set(false);
    }
  }
}
