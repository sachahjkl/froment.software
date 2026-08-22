import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { translate } from '@froment/l10n';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { formatLocalizedDate, LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import {
  BusinessCardContent,
  BusinessCardVersion,
  BusinessCardVersionStorage,
} from './business-card-version-storage';
const defaultContent: BusinessCardContent = {
  name: translate('fr', 'businessCard.defaultName'),
  role: translate('fr', 'businessCard.defaultRole'),
  email: 'contact@froment.software',
  website: 'froment.software',
  brandName: 'froment.software',
};

@Component({
  selector: 'app-business-card',
  imports: [Button, FormField, LocalizedDatePipe, RouterLink],
  templateUrl: './business-card.html',
  styleUrl: './business-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [BusinessCardVersionStorage],
})
export class BusinessCard {
  protected readonly i18n = inject(I18nService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly versionStorage = inject(BusinessCardVersionStorage);
  private versionNameEdited = false;
  protected readonly content = signal<BusinessCardContent>({ ...defaultContent });
  protected readonly contentForm = form(this.content, (fields) => {
    required(fields.name, { message: this.i18n.t('businessCard.nameRequired') });
    required(fields.role, { message: this.i18n.t('businessCard.roleRequired') });
    required(fields.email, { message: this.i18n.t('businessCard.emailRequired') });
    email(fields.email, { message: this.i18n.t('businessCard.emailInvalid') });
    required(fields.website, { message: this.i18n.t('businessCard.websiteRequired') });
    required(fields.brandName, { message: this.i18n.t('businessCard.brandRequired') });
  });
  protected readonly versionModel = signal({ name: this.createVersionName() });
  protected readonly versionForm = form(this.versionModel, (fields) => {
    required(fields.name, { message: this.i18n.t('businessCard.versionRequired') });
  });
  protected readonly versions = this.versionStorage.versions;
  protected readonly storageMessage = signal('');

  print(): void {
    if (this.isBrowser) {
      window.print();
    }
  }

  saveVersion(): void {
    if (this.contentForm().invalid() || this.versionForm().invalid()) {
      this.contentForm().markAsTouched();
      this.versionForm().markAsTouched();
      return;
    }

    const version: BusinessCardVersion = {
      id: crypto.randomUUID(),
      name: this.versionModel().name.trim(),
      createdAt: new Date().toISOString(),
      content: { ...this.content() },
    };
    if (this.versionStorage.save(version)) {
      this.versionNameEdited = false;
      this.versionModel.set({ name: this.createVersionName() });
      this.storageMessage.set(this.i18n.tf('businessCard.saved', { name: version.name }));
    } else {
      this.storageMessage.set(this.i18n.t('businessCard.storageError'));
    }
  }

  restoreVersion(version: BusinessCardVersion): void {
    this.content.set({ ...version.content });
    this.versionNameEdited = true;
    this.versionModel.set({ name: version.name });
    this.storageMessage.set(this.i18n.tf('businessCard.restored', { name: version.name }));
  }

  deleteVersion(version: BusinessCardVersion): void {
    if (this.versionStorage.delete(version.id)) {
      this.storageMessage.set(this.i18n.tf('businessCard.deleted', { name: version.name }));
    } else {
      this.storageMessage.set(this.i18n.t('businessCard.storageError'));
    }
  }

  updateGeneratedVersionName(event: Event): void {
    if (!this.versionNameEdited && event.target instanceof HTMLInputElement) {
      const name = event.target.value.trim() || defaultContent.name;
      this.versionModel.set({ name: this.createVersionName(name) });
    }
  }

  markVersionNameEdited(): void {
    this.versionNameEdited = true;
  }

  private createVersionName(name = this.content?.().name.trim() || defaultContent.name): string {
    const date = formatLocalizedDate(new Date(), 'fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${name} - ${date}`;
  }
}
