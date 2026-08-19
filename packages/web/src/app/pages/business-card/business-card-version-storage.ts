import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export interface BusinessCardContent {
  name: string;
  role: string;
  email: string;
  website: string;
  brandName: string;
}

export interface BusinessCardVersion {
  id: string;
  name: string;
  createdAt: string;
  content: BusinessCardContent;
}

const storageKey = 'froment-software.business-card.versions';

@Injectable()
export class BusinessCardVersionStorage {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly storedVersions = signal<readonly BusinessCardVersion[]>(this.read());
  readonly versions = this.storedVersions.asReadonly();

  save(version: BusinessCardVersion): boolean {
    return this.write([version, ...this.storedVersions()]);
  }

  delete(id: string): boolean {
    return this.write(this.storedVersions().filter((version) => version.id !== id));
  }

  private read(): BusinessCardVersion[] {
    if (!this.isBrowser) {
      return [];
    }
    try {
      const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value) ? value.filter((item) => this.isVersion(item)) : [];
    } catch {
      return [];
    }
  }

  private write(versions: readonly BusinessCardVersion[]): boolean {
    if (!this.isBrowser) {
      return false;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(versions));
      this.storedVersions.set(versions);
      return true;
    } catch {
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
