import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { Authentication } from '@backoffice/authentication';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { SignOut } from './sign-out';

@Component({ template: '<h1>Form</h1>' })
class GuardedForm {
  allowed = false;
  canDeactivate(): boolean {
    return this.allowed;
  }
}
@Component({ template: '<h1>Sign in</h1>' })
class LoginDestination {}

describe('SignOut', () => {
  it('keeps the session until the form permits navigation, then handles failure and retry', async () => {
    let finish!: (value: boolean) => void;
    const signOut = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'form', component: GuardedForm, canDeactivate: [unsavedChangesGuard] },
          { path: 'backoffice/sign-out', component: SignOut, canDeactivate: [unsavedChangesGuard] },
          { path: 'backoffice/login', component: LoginDestination },
        ]),
        { provide: Authentication, useValue: { signOut } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const form = await harness.navigateByUrl('/form', GuardedForm);
    const router = TestBed.inject(Router);
    expect(await router.navigateByUrl('/backoffice/sign-out')).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    form.allowed = true;
    await router.navigateByUrl('/backoffice/sign-out');
    await harness.fixture.whenStable();
    expect(signOut).toHaveBeenCalledOnce();
    expect(await router.navigateByUrl('/backoffice/login')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    finish(false);
    await vi.waitFor(() =>
      expect(harness.fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull(),
    );
    harness.fixture.nativeElement.querySelector('button').click();
    await harness.fixture.whenStable();
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(router.url).toBe('/backoffice/login');
  });
});
