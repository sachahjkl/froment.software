import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
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
        provideHttpClient(),
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
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('administrator@example.test');
    expect(root.querySelector('app-back-office-nav')).not.toBeNull();
    expect(root.querySelector('app-language-selector')).not.toBeNull();
    expect(root.querySelector('app-theme-toggle')).not.toBeNull();
    expect(root.querySelector('.sidebar')?.firstElementChild?.matches('.account')).toBe(true);
    expect(root.querySelector('.sidebar-bottom app-language-selector')).not.toBeNull();
    expect(root.querySelector('.sidebar-bottom app-theme-toggle')).not.toBeNull();
    expect(root.querySelector('.brand')).toBeNull();
    expect(root.querySelector('header a[href="/api/docs"]')?.getAttribute('target')).toBe('_blank');
    expect(root.querySelectorAll('app-back-office-nav a svg')).toHaveLength(12);
    expect(root.querySelector('app-global-search')).not.toBeNull();
    expect(root.querySelector<HTMLSelectElement>('app-language-selector select')?.value).toBe('en');
    expect(root.querySelector('a[href="/services"]')).toBeNull();
    const account = root.querySelector<HTMLButtonElement>('.account-trigger')!;
    account.focus();
    account.click();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const security = overlay.querySelector<HTMLAnchorElement>(
      '[role="menuitem"][href="/backoffice/account"]',
    )!;
    expect(security).not.toBeNull();
    expect(overlay.querySelector('.sign-out')?.textContent).toMatch(/déconnecter|sign out/i);
    security.focus();
    security.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await fixture.whenStable();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(account);
    account.click();
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(false);
    overlay.querySelector<HTMLButtonElement>('.sign-out')!.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith('/backoffice/sign-out');
    expect(signOut).not.toHaveBeenCalled();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
  });
  it('keeps business search and administrative subjects out of the customer shell', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Authentication,
          useValue: {
            currentAccount: () =>
              Promise.resolve({
                userId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
                email: 'client@example.test',
                mode: 'client',
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BackOfficeHeader);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('app-global-search')).toBeNull();
    expect(root.querySelector('app-back-office-nav')).toBeNull();
    expect(root.querySelector('a[href="/backoffice/equipe"]')).toBeNull();
    expect(root.querySelector('a[href="/backoffice/api"]')).toBeNull();
    expect(root.querySelector('.client-navigation a')?.textContent?.trim()).toBe('Documents');
    expect(root.querySelector('.workspace-label')?.textContent?.trim()).toBe('Documents');
    const shortcut = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(shortcut);
    expect(shortcut.defaultPrevented).toBe(false);
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(0);
  });
});
