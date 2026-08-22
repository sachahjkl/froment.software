import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Authentication } from '@backoffice/authentication';
import { Login } from './login';

class AuthStub {
  readonly calls: Array<readonly [string, string]> = [];

  constructor(private readonly mode: 'client' | 'administrator') {}

  authenticate(
    email: string,
    password: string,
  ): Promise<{ success: true; mode: 'client' | 'administrator' }> {
    this.calls.push([email, password]);
    return Promise.resolve({ success: true, mode: this.mode });
  }
}

describe('Login', () => {
  it('redirects an administrator from the single login form', async () => {
    const auth = new AuthStub('administrator');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Login }]),
        { provide: Authentication, useValue: auth },
      ],
    });
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create('/');
    const fixture = harness.fixture;
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.eyebrow')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toContain('Back office');
    const bootstrapLink = () => root.querySelector<HTMLAnchorElement>('.bootstrap-link');
    expect(root.querySelector('.bootstrap-slot')).not.toBeNull();
    expect(bootstrapLink()?.hasAttribute('appLinkButton')).toBe(false);
    expect(bootstrapLink()?.getAttribute('href')).toBe('/backoffice/bootstrap');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const inputs = root.querySelectorAll<HTMLInputElement>('input');
    const [email, password] = inputs;
    if (email === undefined || password === undefined) throw new Error('Login fields are missing.');
    email.value = 'administrator@example.test';
    password.value = 'administrator-password';
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(auth.calls).toEqual([['administrator@example.test', 'administrator-password']]);
    expect(navigate).toHaveBeenCalledWith('/backoffice/dashboard');
  });

  it('returns a client to the requested portal document', async () => {
    const auth = new AuthStub('client');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: Login }]),
        { provide: Authentication, useValue: auth },
      ],
    });
    const router = TestBed.inject(Router);
    const target = '/backoffice/client?quote=01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const harness = await RouterTestingHarness.create(`/?returnUrl=${encodeURIComponent(target)}`);
    const root: HTMLElement = harness.fixture.nativeElement;
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const inputs = root.querySelectorAll<HTMLInputElement>('input');
    const [email, password] = inputs;
    if (email === undefined || password === undefined) throw new Error('Login fields are missing.');
    email.value = 'client@example.test';
    password.value = 'client-password';

    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await harness.fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(target);
  });
});
