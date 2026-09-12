import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import type {
  SupplierInvoiceAnalysisSettings,
  SupplierInvoiceAnalysisSettingsUpdate,
} from '@froment/contracts';

import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

interface SettingsModel {
  readonly adapter: 'local' | 'openai';
  readonly endpoint: string;
  readonly apiKey: string;
}

const isSecureUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username.length === 0 && url.password.length === 0;
  } catch {
    return false;
  }
};

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-invoice-analysis-settings',
  imports: [Breadcrumbs, Button, FormField, Notice, PageHeader],
  templateUrl: './supplier-invoice-analysis-settings.html',
  styleUrl: './supplier-invoice-analysis-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInvoiceAnalysisSettingsPage {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SupplierInvoicesApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly breadcrumbs = signal([
    {
      label: this.i18n.t('backOffice.configuration.title'),
      path: '/backoffice/configuration',
    },
  ]);
  protected readonly model = signal<SettingsModel>({ adapter: 'local', endpoint: '', apiKey: '' });
  protected readonly settingsForm = form(this.model, (path) => {
    validate(path.endpoint, ({ value }) =>
      this.model().adapter === 'openai' && !isSecureUrl(value()) ? { kind: 'url' } : undefined,
    );
  });
  protected readonly settings = signal<typeof SupplierInvoiceAnalysisSettings.Type | undefined>(
    undefined,
  );
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
    if (!this.settingsForm().dirty()) return true;
    return this.confirmation.request(
      this.i18n.t('supplierInvoice.analysisSettings.unsavedChanges'),
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.settingsForm().dirty()) event.preventDefault();
  }

  protected external(): boolean {
    return this.model().adapter === 'openai';
  }

  protected credentialState(): string {
    return this.i18n.t(
      this.settings()?.credentialsPresent
        ? 'supplierInvoice.analysisSettings.credentialPresent'
        : 'supplierInvoice.analysisSettings.credentialMissing',
    );
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.settingsForm().invalid()) {
      this.settingsForm().markAsTouched();
      return;
    }
    void submit(this.settingsForm, async () => {
      this.saving.set(true);
      this.saved.set(false);
      this.error.set(undefined);
      try {
        const model = this.model();
        let request: typeof SupplierInvoiceAnalysisSettingsUpdate.Type = {
          adapter: model.adapter,
          endpoint: model.adapter === 'openai' ? model.endpoint : null,
        };
        if (model.apiKey.length > 0) request = { ...request, apiKey: model.apiKey };
        const outcome = await this.api.updateAnalysisSettings(request);
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.apply(outcome.result);
        this.saved.set(true);
      } catch {
        this.error.set('supplierInvoice.analysisSettings.error');
      } finally {
        this.saving.set(false);
      }
    });
  }

  private async load(): Promise<void> {
    try {
      const outcome = await this.api.analysisSettings();
      if (outcome.success) this.apply(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      this.error.set('supplierInvoice.analysisSettings.error');
    } finally {
      this.loading.set(false);
    }
  }

  private apply(settings: typeof SupplierInvoiceAnalysisSettings.Type): void {
    this.settings.set(settings);
    this.model.set({ adapter: settings.adapter, endpoint: settings.endpoint ?? '', apiKey: '' });
    this.settingsForm().reset();
  }
}
