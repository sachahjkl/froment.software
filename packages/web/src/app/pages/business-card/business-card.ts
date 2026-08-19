import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/button/button';
import {
  formatLocalizedDate,
  LocalizedDatePipe,
} from '../../shared/localized-date/localized-date-pipe';
import {
  BusinessCardContent,
  BusinessCardVersion,
  BusinessCardVersionStorage,
} from './business-card-version-storage';
const defaultContent: BusinessCardContent = {
  name: 'Sacha Froment',
  role: 'Ingénieur logiciel',
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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly versionStorage = inject(BusinessCardVersionStorage);
  private versionNameEdited = false;
  protected readonly content = signal<BusinessCardContent>({ ...defaultContent });
  protected readonly contentForm = form(this.content, (fields) => {
    required(fields.name, { message: 'Le nom est requis.' });
    required(fields.role, { message: 'Le poste est requis.' });
    required(fields.email, { message: 'L’adresse e-mail est requise.' });
    email(fields.email, { message: 'L’adresse e-mail est invalide.' });
    required(fields.website, { message: 'Le site web est requis.' });
    required(fields.brandName, { message: 'Le nom de marque est requis.' });
  });
  protected readonly versionModel = signal({ name: this.createVersionName() });
  protected readonly versionForm = form(this.versionModel, (fields) => {
    required(fields.name, { message: 'Le nom de la version est requis.' });
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
      this.storageMessage.set(`Version « ${version.name} » enregistrée dans ce navigateur.`);
    } else {
      this.storageMessage.set('L’enregistrement local a échoué.');
    }
  }

  restoreVersion(version: BusinessCardVersion): void {
    this.content.set({ ...version.content });
    this.versionNameEdited = true;
    this.versionModel.set({ name: version.name });
    this.storageMessage.set(`Version « ${version.name} » restaurée.`);
  }

  deleteVersion(version: BusinessCardVersion): void {
    if (this.versionStorage.delete(version.id)) {
      this.storageMessage.set(`Version « ${version.name} » supprimée.`);
    } else {
      this.storageMessage.set('L’enregistrement local a échoué.');
    }
  }

  updateGeneratedVersionName(event: Event): void {
    if (!this.versionNameEdited) {
      const name = (event.target as HTMLInputElement).value.trim() || defaultContent.name;
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
