import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { BackOfficeLogin } from './back-office-login';

class AuthStub {
  readonly calls: Array<{ accessIdentifier: string; mode: string }> = [];

  authenticate(accessIdentifier: string, mode: string): Promise<{ success: true }> {
    this.calls.push({ accessIdentifier, mode });
    return Promise.resolve({ success: true });
  }
}

describe('BackOfficeLogin', () => {
  it('switches from client to administrator mode', async () => {
    const auth = new AuthStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BackOfficeAuth, useValue: auth }],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BackOfficeLogin);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    const bootstrapLink = () => root.querySelector<HTMLAnchorElement>('.bootstrap-link');
    expect(bootstrapLink()).toBeNull();

    root.querySelector<HTMLButtonElement>('#administrator-tab')?.click();
    await fixture.whenStable();

    expect(bootstrapLink()?.hasAttribute('appLinkButton')).toBe(false);
    expect(bootstrapLink()?.getAttribute('href')).toBe('/back-office/bootstrap');

    const input = root.querySelector<HTMLInputElement>('input');
    if (input === null) return;
    input.value = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(auth.calls).toEqual([
      {
        accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        mode: 'administrator',
      },
    ]);
    expect(navigate).toHaveBeenCalledWith('/back-office/dashboard');
  });
});
