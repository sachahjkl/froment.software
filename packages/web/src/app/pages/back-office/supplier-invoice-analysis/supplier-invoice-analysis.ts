import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { Router } from '@angular/router';
import type { SupplierInvoiceAnalysisStatus, SupplierSummaryValue } from '@froment/contracts';

import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { SuppliersApi } from '@backoffice/suppliers-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

const acceptedMediaTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type AcceptedMediaType = (typeof acceptedMediaTypes)[number];
const dataUrlSeparator = ',';
const fileReadErrorCode = 'supplier-invoice-analysis-file-read';
const isAcceptedMediaType = (value: string): value is AcceptedMediaType =>
  acceptedMediaTypes.some((mediaType) => mediaType === value);

interface AnalysisModel {
  readonly supplierId: string;
  readonly consent: boolean;
}

const readBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('error', () => reject(reader.error));
    reader.addEventListener('load', () => {
      // SAFETY: FileReader returns a data URL string after readAsDataURL completes.
      const result = reader.result as string;
      if (!result.includes(dataUrlSeparator)) return reject(new Error(fileReadErrorCode));
      resolve(result.slice(result.indexOf(dataUrlSeparator) + dataUrlSeparator.length));
    });
    reader.readAsDataURL(file);
  });

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-invoice-analysis',
  imports: [Breadcrumbs, Button, FormField, Notice, PageHeader],
  templateUrl: './supplier-invoice-analysis.html',
  styleUrl: './supplier-invoice-analysis.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInvoiceAnalysisPage {
  protected readonly i18n = inject(I18nService);
  private readonly invoicesApi = inject(SupplierInvoicesApi);
  private readonly suppliersApi = inject(SuppliersApi);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = signal([
    { label: this.i18n.t('supplierInvoice.title'), path: '/backoffice/purchases' },
  ]);
  protected readonly model = signal<AnalysisModel>({ supplierId: '', consent: false });
  protected readonly analysisForm = form(this.model, (path) => required(path.supplierId));
  protected readonly suppliers = signal<ReadonlyArray<SupplierSummaryValue>>([]);
  protected readonly settings = signal<typeof SupplierInvoiceAnalysisStatus.Type | undefined>(
    undefined,
  );
  protected readonly file = signal<File | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected external(): boolean {
    return this.settings()?.external === true;
  }

  protected selectFile(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const selected = input.files?.item(0) ?? undefined;
    this.file.set(selected);
    if (selected && !isAcceptedMediaType(selected.type)) {
      this.error.set('supplierInvoice.analysis.invalidFile');
    } else {
      this.error.set(undefined);
    }
  }

  protected analyze(event: SubmitEvent): void {
    event.preventDefault();
    const file = this.file();
    if (this.submitting() || this.analysisForm().invalid() || file === undefined) {
      this.analysisForm().markAsTouched();
      if (file === undefined) this.error.set('supplierInvoice.analysis.fileRequired');
      return;
    }
    if (!isAcceptedMediaType(file.type)) {
      this.error.set('supplierInvoice.analysis.invalidFile');
      return;
    }
    const mediaType = file.type;
    void submit(this.analysisForm, async () => {
      this.submitting.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.invoicesApi.analyze({
          requestId: crypto.randomUUID(),
          supplierId: this.model().supplierId,
          fileName: file.name,
          mediaType,
          contentBase64: await readBase64(file),
          consent: this.model().consent,
        });
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        await this.router.navigate(['/backoffice/purchases', outcome.result.id]);
      } catch {
        this.error.set('supplierInvoice.analysis.failed');
      } finally {
        this.submitting.set(false);
      }
    });
  }

  private async load(): Promise<void> {
    try {
      const [suppliers, settings] = await Promise.all([
        this.suppliersApi.list(),
        this.invoicesApi.analysisStatus(),
      ]);
      this.suppliers.set(suppliers.filter((supplier) => !supplier.archived));
      if (settings.success) this.settings.set(settings.result);
      else this.error.set(settings.code);
    } catch {
      this.error.set('supplierInvoice.analysis.failed');
    } finally {
      this.loading.set(false);
    }
  }
}
