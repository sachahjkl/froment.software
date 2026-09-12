import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import {
  disabled,
  FormField,
  form,
  max,
  min,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import type {
  CompanyModuleValue,
  CompanySettingsUpdateRequestValue,
  CompanySettingsValue,
} from '@froment/contracts';

import { Can } from '@backoffice/can';
import { CompanyApi } from '@backoffice/company-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

type CompanyModel = Omit<CompanySettingsUpdateRequestValue, 'expectedVersion'>;

const modules: readonly CompanyModuleValue[] = [
  'sales',
  'purchasing',
  'banking',
  'accounting',
  'tax',
  'demonstration',
];

const initialModel = (): CompanyModel => ({
  jurisdiction: 'FR',
  functionalCurrency: 'EUR',
  fiscalYearStartMonth: 1,
  fiscalYearStartDay: 1,
  enabledModules: [],
  retentionYears: 10,
});

@Component({
  host: { class: 'page-container' },
  selector: 'app-company-settings',
  imports: [Button, Can, FormField, Notice, PageHeader],
  templateUrl: './company-settings.html',
  styleUrl: './company-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanySettingsPage {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(CompanyApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly modules = modules;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly settings = signal<CompanySettingsValue | undefined>(undefined);
  protected readonly model = signal<CompanyModel>(initialModel());
  protected readonly settingsForm = form(this.model, (path) => {
    required(path.functionalCurrency);
    pattern(path.functionalCurrency, /^[A-Z]{3}$/);
    disabled(path.functionalCurrency, () => this.currencyLocked());
    min(path.fiscalYearStartMonth, 1);
    max(path.fiscalYearStartMonth, 12);
    min(path.fiscalYearStartDay, 1);
    max(path.fiscalYearStartDay, 31);
    min(path.retentionYears, 10);
  });
  protected readonly saving = signal(false);
  protected readonly initializing = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving() || this.initializing()) return false;
    if (!this.settingsForm().dirty()) return true;
    return this.confirmation.request(this.i18n.t('company.unsavedChanges'));
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.initializing() || this.settingsForm().dirty()) event.preventDefault();
  }

  protected moduleEnabled(module: CompanyModuleValue): boolean {
    return this.model().enabledModules.includes(module);
  }

  protected setModule(module: CompanyModuleValue, event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    const enabled = event.currentTarget.checked;
    this.model.update((model) => ({
      ...model,
      enabledModules: enabled
        ? [...model.enabledModules, module]
        : model.enabledModules.filter((value) => value !== module),
    }));
  }

  protected moduleLabel(module: CompanyModuleValue): string {
    return this.i18n.t(`company.module.${module}`);
  }

  protected currencyLocked(): boolean {
    return this.settings()?.accountingInitialized === true;
  }

  protected accountingState(): string {
    return this.i18n.t(
      this.currencyLocked() ? 'company.accountingInitialized' : 'company.accountingNotInitialized',
    );
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    this.error.set(undefined);
    const outcome = await this.api.get();
    if (!outcome.success) {
      this.error.set(outcome.code);
      this.state.set('error');
      return;
    }
    this.apply(outcome.result);
    this.state.set('ready');
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.settingsForm().invalid()) {
      this.settingsForm().markAsTouched();
      return;
    }
    const settings = this.settings();
    if (!settings) return;
    void submit(this.settingsForm, async () => {
      this.saving.set(true);
      this.saved.set(false);
      this.error.set(undefined);
      try {
        const outcome = await this.api.update({
          ...this.model(),
          expectedVersion: settings.version,
        });
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.apply(outcome.result);
        this.saved.set(true);
      } catch {
        this.error.set('company.error');
      } finally {
        this.saving.set(false);
      }
    });
  }

  protected async initializeAccounting(): Promise<void> {
    const settings = this.settings();
    if (!settings || settings.accountingInitialized || this.initializing()) return;
    if (!(await this.confirmation.request(this.i18n.t('company.initializeConfirm')))) return;
    this.initializing.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.initializeAccounting({
        functionalCurrency: this.model().functionalCurrency,
        expectedVersion: settings.version,
      });
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.apply(outcome.result);
      this.saved.set(true);
    } catch {
      this.error.set('company.error');
    } finally {
      this.initializing.set(false);
    }
  }

  private apply(settings: CompanySettingsValue): void {
    this.settings.set(settings);
    this.settingsForm().reset({
      jurisdiction: settings.jurisdiction,
      functionalCurrency: settings.functionalCurrency,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      fiscalYearStartDay: settings.fiscalYearStartDay,
      enabledModules: settings.enabledModules,
      retentionYears: settings.retentionYears,
    });
  }
}
