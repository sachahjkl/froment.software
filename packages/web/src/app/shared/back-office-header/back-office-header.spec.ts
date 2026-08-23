import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Authentication } from '@backoffice/authentication';
import { BackOfficeHeader } from './back-office-header';

describe('BackOfficeHeader', () => {
  it('shows the administrator account, navigation, and sign-out action', async () => {
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
            signOut: () => Promise.resolve(true),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BackOfficeHeader);
    fixture.componentRef.setInput('administrator', true);
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('administrator@example.test');
    expect(root.querySelector('app-back-office-nav')).not.toBeNull();
    expect(Array.from(root.querySelectorAll('button'), (button) => button.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/déconnecter|sign out/i)]),
    );
    expect(root.querySelector('.sign-out[data-button-variant="danger"] svg')).not.toBeNull();
    expect(root.querySelector('app-language-selector')).toBeNull();
    expect(root.querySelector('app-theme-toggle')).toBeNull();
    expect(root.querySelector('a[href="/services"]')).toBeNull();
  });
});
