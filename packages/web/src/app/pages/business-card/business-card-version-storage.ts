import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Option, Schema } from 'effect';

export const BusinessCardContent = Schema.Struct({
  name: Schema.String,
  role: Schema.String,
  email: Schema.String,
  website: Schema.String,
  brandName: Schema.String,
});
export interface BusinessCardContent extends Schema.Schema.Type<typeof BusinessCardContent> {}

export const BusinessCardVersion = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  content: BusinessCardContent,
});
export interface BusinessCardVersion extends Schema.Schema.Type<typeof BusinessCardVersion> {}

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
      const value = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(
        localStorage.getItem(storageKey) ?? '[]',
      );
      if (!Array.isArray(value)) {
        return [];
      }
      return value.flatMap((item) =>
        Option.match(Schema.decodeUnknownOption(BusinessCardVersion)(item), {
          onNone: () => [],
          onSome: (version) => [version],
        }),
      );
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
}
