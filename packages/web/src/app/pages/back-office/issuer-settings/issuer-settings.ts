import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import {
  FormField,
  disabled,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { type IssuerSettingsValue } from '@froment/contracts';
import { RouterLink } from '@angular/router';

import { IssuerSettingsApi } from '@backoffice/issuer-settings-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

const emptySettings = (): IssuerSettingsValue => ({
  displayName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  phone: '',
  registrationNumber: '',
  vatNumber: '',
});

@Component({
  selector: 'app-issuer-settings',
  imports: [Can, Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './issuer-settings.html',
  styleUrl: './issuer-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssuerSettings {
  private readonly authentication = inject(Authentication);
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IssuerSettingsApi);
  private readonly model = signal(emptySettings());
  private readonly version = signal(0);
  protected readonly settingsForm = form(this.model, (path) => {
    disabled(path, () => this.saveDisabled());
    required(path.displayName);
    pattern(path.displayName, /\S/);
    maxLength(path.displayName, 160);
    maxLength(path.addressLine1, 160);
    maxLength(path.addressLine2, 160);
    maxLength(path.postalCode, 32);
    maxLength(path.city, 120);
    maxLength(path.country, 120);
    maxLength(path.email, 254);
    maxLength(path.phone, 64);
    maxLength(path.registrationNumber, 64);
    maxLength(path.vatNumber, 64);
  });
  protected readonly loading = signal(true);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saveDisabled = computed(
    () =>
      !this.authentication.can('issuer.update') ||
      this.loading() ||
      this.saving() ||
      !this.loaded(),
  );

  protected invalid(field: keyof IssuerSettingsValue): boolean {
    return this.settingsForm[field]().touched() && this.settingsForm[field]().invalid();
  }

  constructor() {
    afterNextRender(() => void this.load());
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
    return (
      !this.settingsForm().dirty() ||
      (await this.confirmation.request(this.i18n.t('backOffice.quote.unsavedChanges')))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.settingsForm().dirty()) event.preventDefault();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saveDisabled()) return;
    if (this.settingsForm().invalid()) {
      this.settingsForm().markAsTouched();
      this.settingsForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.settingsForm, async () => {
      this.saving.set(true);
      this.saved.set(false);
      this.error.set(undefined);
      const outcome = await this.api.update({ ...this.model(), expectedVersion: this.version() });
      this.saving.set(false);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      const { version, ...settings } = outcome.result;
      this.version.set(version);
      this.model.set(settings);
      this.settingsForm().reset();
      this.saved.set(true);
    });
  }

  protected async load(): Promise<void> {
    if (!(await this.canDeactivate())) return;
    this.loading.set(true);
    this.loaded.set(false);
    this.saved.set(false);
    this.error.set(undefined);
    try {
      const { version, ...settings } = await this.api.get();
      this.version.set(version);
      this.model.set(settings);
      this.settingsForm().reset();
      this.loaded.set(true);
    } catch {
      this.error.set('issuer.error');
    } finally {
      this.loading.set(false);
    }
  }
}
