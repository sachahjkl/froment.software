import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Button } from '../../shared/button/button';

interface BusinessCardContent {
  name: string;
  role: string;
  email: string;
  website: string;
  brandName: string;
}

interface BusinessCardVersion {
  id: string;
  name: string;
  createdAt: string;
  content: BusinessCardContent;
}

const storageKey = 'froment-software.business-card.versions';
const defaultContent: BusinessCardContent = {
  name: 'Sacha Froment',
  role: 'Ingénieur logiciel',
  email: 'contact@froment.software',
  website: 'froment.software',
  brandName: 'froment.software',
};

@Component({
  selector: 'app-business-card',
  imports: [Button, FormField, RouterLink],
  templateUrl: './business-card.html',
  styleUrl: './business-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusinessCard {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
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
  protected readonly versions = signal<BusinessCardVersion[]>(this.readVersions());
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
    const versions = [version, ...this.versions()];

    if (this.writeVersions(versions)) {
      this.versions.set(versions);
      this.versionNameEdited = false;
      this.versionModel.set({ name: this.createVersionName() });
      this.storageMessage.set(`Version « ${version.name} » enregistrée dans ce navigateur.`);
    }
  }

  restoreVersion(version: BusinessCardVersion): void {
    this.content.set({ ...version.content });
    this.versionNameEdited = true;
    this.versionModel.set({ name: version.name });
    this.storageMessage.set(`Version « ${version.name} » restaurée.`);
  }

  deleteVersion(version: BusinessCardVersion): void {
    const versions = this.versions().filter(({ id }) => id !== version.id);

    if (this.writeVersions(versions)) {
      this.versions.set(versions);
      this.storageMessage.set(`Version « ${version.name} » supprimée.`);
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
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
    const date = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
    return `${name} - ${date}`;
  }

  private readVersions(): BusinessCardVersion[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value)
        ? value.filter((item): item is BusinessCardVersion => this.isVersion(item))
        : [];
    } catch {
      return [];
    }
  }

  private writeVersions(versions: BusinessCardVersion[]): boolean {
    if (!this.isBrowser) {
      return false;
    }

    try {
      localStorage.setItem(storageKey, JSON.stringify(versions));
      return true;
    } catch {
      this.storageMessage.set('L’enregistrement local a échoué.');
      return false;
    }
  }

  private isVersion(value: unknown): value is BusinessCardVersion {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const version = value as Record<string, unknown>;
    const content = version['content'];
    return (
      typeof version['id'] === 'string' &&
      typeof version['name'] === 'string' &&
      typeof version['createdAt'] === 'string' &&
      !!content &&
      typeof content === 'object' &&
      ['name', 'role', 'email', 'website', 'brandName'].every(
        (key) => typeof (content as Record<string, unknown>)[key] === 'string',
      )
    );
  }
}
