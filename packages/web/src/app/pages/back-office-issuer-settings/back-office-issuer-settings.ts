import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { type IssuerSettingsValue } from '@froment/contracts';

import { BackOfficeIssuerSettingsApi } from '@backoffice/back-office-issuer-settings-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';

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
  selector: 'app-back-office-issuer-settings',
  imports: [Button, FormField, RouterLink],
  templateUrl: './back-office-issuer-settings.html',
  styleUrl: './back-office-issuer-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeIssuerSettings {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BackOfficeIssuerSettingsApi);
  private readonly model = signal(emptySettings());
  protected readonly settingsForm = form(this.model, (path) => {
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
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saveDisabled = computed(
    () =>
      this.loading() ||
      this.saving() ||
      this.settingsForm().invalid() ||
      !this.settingsForm().dirty(),
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  canDeactivate(): boolean {
    return (
      !this.settingsForm().dirty() ||
      globalThis.confirm(this.i18n.t('backOffice.quote.unsavedChanges'))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.settingsForm().dirty()) event.preventDefault();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.settingsForm, async () => {
      this.saving.set(true);
      this.saved.set(false);
      this.error.set(undefined);
      const outcome = await this.api.update(this.model());
      this.saving.set(false);
      if (!outcome.success) {
        this.error.set(
          outcome.code === 'request.rate_limited' ? 'request.rate_limited' : 'issuer.error',
        );
        return;
      }
      this.model.set(outcome.result);
      this.settingsForm().reset();
      this.saved.set(true);
    });
  }

  private async load(): Promise<void> {
    try {
      this.model.set(await this.api.get());
      this.settingsForm().reset();
    } catch {
      this.error.set('issuer.error');
    } finally {
      this.loading.set(false);
    }
  }
}
