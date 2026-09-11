import { provideHttpClient } from '@angular/common/http';
import { Component, TransferState } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { provideAccount } from '@backoffice/account.spec-helper';
import { App } from './app';
import { APP_SHELL_STATE, type AppShell } from './app-shell';

@Component({ selector: 'app-startup-page', template: '' })
class StartupPage {}

function setup(transferredShell?: AppShell) {
  const decision = new Subject<boolean | UrlTree>();
  const guard = vi.fn(() => decision);
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideHttpClient(),
      provideAccount(),
      provideRouter([
        {
          path: 'workspace',
          component: StartupPage,
          canActivate: [guard],
          data: { shell: 'administrator' },
        },
        { path: 'other', component: StartupPage, canActivate: [guard], data: { shell: 'public' } },
        { path: 'login', component: StartupPage, data: { shell: 'public' } },
      ]),
    ],
  });
  const transfer = TestBed.inject(TransferState);
  if (transferredShell !== undefined) transfer.set(APP_SHELL_STATE, transferredShell);
  const fixture = TestBed.createComponent(App);
  const element: HTMLElement = fixture.nativeElement;
  fixture.detectChanges();
  return { fixture, element, decision, guard, transfer, router: TestBed.inject(Router) };
}

describe('initial shell loading', () => {
  it('shows the back-office placeholder while its guard waits, without a public header or protected content', async () => {
    const { fixture, element, decision, guard, router, transfer } = setup();
    expect(element.querySelector('app-site-header')).toBeNull();
    expect(element.querySelector('[role="status"]')).not.toBeNull();
    const navigation = router.navigateByUrl('/workspace');
    await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce());
    fixture.detectChanges();
    expect(element.querySelector('app-back-office-header-placeholder')).not.toBeNull();
    expect(element.querySelector('app-site-header, app-site-footer, app-startup-page')).toBeNull();
    decision.next(true);
    await navigation;
    await fixture.whenStable();
    expect(fixture.componentInstance['startup']()).toBe('ready');
    expect(element.querySelector('app-startup-page')).not.toBeNull();
    expect(element.querySelector('.startup-status')).toBeNull();
    expect(JSON.parse(transfer.toJson())['app-shell']).toBe('administrator');
  });

  it('uses the public shell after an initial authentication redirect', async () => {
    const { fixture, element, decision, guard, router } = setup();
    const navigation = router.navigateByUrl('/workspace');
    await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce());
    decision.next(router.createUrlTree(['/login']));
    await navigation;
    await fixture.whenStable();
    expect(router.url).toBe('/login');
    expect(element.querySelector('app-site-header')).not.toBeNull();
    expect(element.querySelector('app-back-office-header-placeholder')).toBeNull();
    expect(fixture.componentInstance['startup']()).toBe('ready');
  });

  it('retains the active shell while a later navigation waits or is cancelled', async () => {
    const { fixture, element, decision, guard, router } = setup();
    const first = router.navigateByUrl('/workspace');
    await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce());
    decision.next(true);
    await first;
    await fixture.whenStable();
    const page = element.querySelector('app-startup-page');
    const next = router.navigateByUrl('/other');
    await vi.waitFor(() => expect(guard).toHaveBeenCalledTimes(2));
    fixture.detectChanges();
    expect(fixture.componentInstance['backOffice']()).toBe(true);
    expect(fixture.componentInstance['startup']()).toBe('ready');
    expect(element.querySelector('app-startup-page')).toBe(page);
    expect(element.querySelector('.startup-status')).toBeNull();
    decision.next(false);
    await next;
    expect(router.url).toBe('/workspace');
    expect(fixture.componentInstance['backOffice']()).toBe(true);
  });

  it.each(['public', 'standalone'] as const)(
    'preserves the transferred %s shell for hydration',
    (shell) => {
      const { fixture, element } = setup(shell);
      expect(fixture.componentInstance['startup']()).toBe('ready');
      expect(fixture.componentInstance['publicPage']()).toBe(shell === 'public');
      expect(fixture.componentInstance['standalonePage']()).toBe(shell === 'standalone');
      expect(element.querySelector('.startup-status')).toBeNull();
    },
  );

  it('ends the loading state when the initial navigation fails', async () => {
    const { fixture, element, decision, guard, router } = setup();
    const navigation = router.navigateByUrl('/workspace');
    const rejected = expect(navigation).rejects.toThrow('Initial load failed');
    await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce());
    decision.error(new Error('Initial load failed'));
    await rejected;
    fixture.detectChanges();
    expect(fixture.componentInstance['startup']()).toBe('error');
    expect(element.querySelector('.startup-status [role="alert"]')).not.toBeNull();
    expect(element.querySelector('.loading-spinner')).toBeNull();
  });
});
