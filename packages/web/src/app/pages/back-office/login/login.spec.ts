import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Authentication } from '@backoffice/authentication';
import { Login } from './login';

class AuthStub {
  readonly calls: Array<{ accessIdentifier: string; mode: string }> = [];

  authenticate(accessIdentifier: string, mode: string): Promise<{ success: true }> {
    this.calls.push({ accessIdentifier, mode });
    return Promise.resolve({ success: true });
  }
}

describe('Login', () => {
  it('switches from client to administrator mode', async () => {
    const auth = new AuthStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Authentication, useValue: auth }],
    });
    const router = TestBed.inject(Router);
    const modeNavigation = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.eyebrow')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toContain('Back office');

    const bootstrapSlot = root.querySelector<HTMLElement>('.bootstrap-slot');
    const bootstrapLink = () => root.querySelector<HTMLAnchorElement>('.bootstrap-link');
    expect(bootstrapSlot).not.toBeNull();
    expect(bootstrapLink()).toBeNull();

    root.querySelector<HTMLButtonElement>('#administrator-tab')?.click();
    await fixture.whenStable();

    expect(modeNavigation).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { mode: 'admin' }, replaceUrl: true }),
    );
    expect(root.querySelector('.bootstrap-slot')).toBe(bootstrapSlot);
    expect(bootstrapLink()?.hasAttribute('appLinkButton')).toBe(false);
    expect(bootstrapLink()?.getAttribute('href')).toBe('/backoffice/bootstrap');

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
    expect(navigate).toHaveBeenCalledWith('/backoffice/dashboard');
  });
});
