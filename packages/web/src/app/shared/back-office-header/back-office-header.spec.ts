import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, vi } from 'vitest';

import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { BackOfficeHeader } from './back-office-header';

describe('BackOfficeHeader', () => {
  beforeEach(() =>
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  afterEach(() => vi.unstubAllGlobals());
  it('shows the administrator account, navigation, and sign-out action', async () => {
    const signOut = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Authentication,
          useValue: {
            currentAccount: () =>
              Promise.resolve({
                userId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
                email: 'administrator@example.test',
                mode: 'administrator',
              }),
            signOut,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BackOfficeHeader);
    TestBed.inject(I18nService).setLanguage('en');
    fixture.componentRef.setInput('administrator', true);
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('administrator@example.test');
    expect(root.querySelector('app-back-office-nav')).not.toBeNull();
    expect(Array.from(root.querySelectorAll('button'), (button) => button.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/déconnecter|sign out/i)]),
    );
    expect(root.querySelector('.sign-out[data-button-variant="default"] svg')).not.toBeNull();
    expect(root.querySelector('.sign-out')?.textContent).toMatch(/déconnecter|sign out/i);
    expect(root.querySelector('app-language-selector')).not.toBeNull();
    expect(root.querySelector('app-theme-toggle')).not.toBeNull();
    expect(root.querySelector('.sidebar')?.firstElementChild?.matches('.account')).toBe(true);
    expect(root.querySelector('.account-details app-language-selector')).not.toBeNull();
    expect(root.querySelector('.account-details app-theme-toggle')).not.toBeNull();
    expect(root.querySelector('.brand')).toBeNull();
    expect(root.querySelector('header a[href="/api/docs"]')?.getAttribute('target')).toBe('_blank');
    expect(root.querySelectorAll('app-back-office-nav a svg')).toHaveLength(8);
    expect(root.querySelector<HTMLSelectElement>('app-language-selector select')?.value).toBe('en');
    expect(root.querySelector('a[href="/services"]')).toBeNull();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(false);
    root.querySelector<HTMLButtonElement>('.sign-out')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/backoffice/sign-out');
    expect(signOut).not.toHaveBeenCalled();
  });
});
