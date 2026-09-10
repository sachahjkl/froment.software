import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Schema } from 'effect';
import { ClientList, CurrentAccount, InvoiceList, OrderList, QuoteList } from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessContext, type BusinessSettings } from './business-context';
import { BusinessPreview } from './business-preview';

describe('Isolated business previews', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(I18nService).setLanguage('en');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('reference.unexpected_fetch'));
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).expectNone(() => true);
    TestBed.inject(HttpTestingController).verify();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setup(
    component: string,
    scenario: BusinessSettings['scenario'] = 'ready',
    administrator = true,
  ) {
    const settings: BusinessSettings = {
      scenario,
      administrator,
      path: '/backoffice/affaires',
      kind: 'quote',
      party: 'both',
    };
    const fixture = TestBed.createComponent(BusinessPreview);
    fixture.componentRef.setInput('component', component);
    fixture.componentRef.setInput('settings', settings);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const context = fixture.debugElement.injector.get(BusinessContext);
    return { fixture, root, context, settings };
  }

  function search(root: HTMLElement) {
    const input = root.querySelector<HTMLInputElement>('app-global-search input')!;
    input.focus();
    input.value = 'Atlas';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input;
  }

  it('provides complete schema-valid data through the exact read contracts', async () => {
    const { fixture } = setup('global-search');
    const injector = fixture.debugElement.injector;
    expect(
      Schema.decodeUnknownSync(CurrentAccount)(await injector.get(Authentication).currentAccount())
        .mode,
    ).toBe('administrator');
    expect(
      Schema.decodeUnknownSync(ClientList)(await injector.get(ClientsApi).list()),
    ).toHaveLength(1);
    expect(Schema.decodeUnknownSync(QuoteList)(await injector.get(QuotesApi).list())).toHaveLength(
      1,
    );
    expect(Schema.decodeUnknownSync(OrderList)(await injector.get(OrdersApi).list())).toHaveLength(
      1,
    );
    expect(
      Schema.decodeUnknownSync(InvoiceList)(await injector.get(InvoicesApi).list()),
    ).toHaveLength(1);
  });

  it('renders four search categories and intercepts the result destination', async () => {
    const { fixture, root, context } = setup('global-search');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const initialUrl = router.url;
    search(root);
    await fixture.whenStable();
    expect(root.querySelectorAll('.results section')).toHaveLength(4);
    const links = root.querySelectorAll<HTMLAnchorElement>('.results li a');
    expect(links).toHaveLength(4);
    for (const link of links)
      expect(link.getAttribute('href')).toMatch(new RegExp(`^${initialUrl}#preview=`));
    expect(new Set(Array.from(links, (link) => link.getAttribute('href'))).size).toBe(4);
    links[0].click();
    await fixture.whenStable();
    expect(context.destination()).toBe(`/backoffice/clients/${context.text().examples.clientId}`);
    expect(root.querySelector('.results')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(router.url).toBe(initialUrl);
  });

  it('keeps loading visible until local data is released', async () => {
    const { fixture, root } = setup('global-search', 'loading');
    const input = search(root);
    await fixture.whenStable();
    expect(root.querySelector('.results > [role="status"]')?.textContent).toBe(
      TestBed.inject(I18nService).t('backOffice.dashboard.loading'),
    );
    expect(root.querySelectorAll('.results li')).toHaveLength(0);
    root.querySelector<HTMLButtonElement>('[data-complete-preview]')!.click();
    input.focus();
    await fixture.whenStable();
    expect(root.querySelectorAll('.results li')).toHaveLength(4);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(root.querySelector('.results')).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('shows a search error and retries against restored local data', async () => {
    const { fixture, root, context } = setup('global-search', 'error');
    search(root);
    await fixture.whenStable();
    expect(root.querySelector('.results [role="alert"]')?.textContent).toBe(
      TestBed.inject(I18nService).t('backOffice.dashboard.error'),
    );
    context.complete();
    root.querySelector<HTMLButtonElement>('.results > button')!.click();
    await fixture.whenStable();
    expect(root.querySelector('.results [role="alert"]')).toBeNull();
    expect(root.querySelectorAll('.results li')).toHaveLength(4);
  });

  it('renders an empty search without reaching the real services', async () => {
    const reads = [
      vi.spyOn(ClientsApi.prototype, 'list'),
      vi.spyOn(QuotesApi.prototype, 'list'),
      vi.spyOn(OrdersApi.prototype, 'list'),
      vi.spyOn(InvoicesApi.prototype, 'list'),
    ];
    const { fixture, root } = setup('global-search', 'empty');
    search(root);
    await fixture.whenStable();
    expect(root.querySelector('.result-heading [role="status"]')?.textContent).toContain('0');
    expect(root.querySelector('.results')?.textContent).toContain(
      TestBed.inject(I18nService).t('backOffice.search.empty'),
    );
    expect(root.querySelectorAll('.results li')).toHaveLength(0);
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it('intercepts account sign-out, router links and the native API link', async () => {
    const account = vi.spyOn(Authentication.prototype, 'currentAccount');
    const logout = vi.spyOn(Authentication.prototype, 'signOut');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { fixture, root, context } = setup('back-office-header');
    const sidebar = root.querySelector<HTMLElement>('.sidebar')!;
    await vi.waitFor(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      expect(sidebar.querySelector('.account')?.textContent).toContain(
        context.text().examples.email,
      );
    });
    expect(root.querySelectorAll('app-global-search')).toHaveLength(1);
    expect(sidebar.querySelector('.account-status')).toBeNull();
    sidebar.querySelector<HTMLElement>('.account summary')!.click();
    const securityLink = sidebar.querySelector<HTMLAnchorElement>('.account-details a')!;
    const securityUrl = new URL(securityLink.href);
    expect(securityUrl.pathname).toBe(TestBed.inject(Router).url);
    expect(decodeURIComponent(securityUrl.hash)).toBe('#preview=/backoffice/account');
    securityLink.click();
    await fixture.whenStable();
    expect(context.destination()).toBe('/backoffice/account');
    expect(sidebar.querySelector<HTMLDetailsElement>('.account')!.open).toBe(false);
    sidebar.querySelector<HTMLElement>('.account summary')!.click();
    sidebar.querySelector<HTMLButtonElement>('.sign-out')!.click();
    await fixture.whenStable();
    expect(context.destination()).toBe('/backoffice/sign-out');
    const link = root.querySelector<HTMLAnchorElement>('[data-reference-destination]')!;
    expect(new URL(link.href).pathname).toBe(TestBed.inject(Router).url);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(context.destination()).toBe('/api/docs');
    expect(account).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the client account without administrator navigation or business search', async () => {
    const { fixture, root, context } = setup('back-office-header', 'ready', false);
    await vi.waitFor(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      expect(root.querySelector('.sidebar .account')?.textContent).toContain(
        context.text().examples.email,
      );
    });
    expect((await context.currentAccount())?.mode).toBe('client');
    expect(root.querySelector('app-global-search, app-back-office-nav')).toBeNull();
    expect(root.querySelector('.client-navigation a')).not.toBeNull();
  });

  it('keeps the local providers inside the real mobile Drawer and restores focus', async () => {
    const { fixture, root, context } = setup('back-office-header');
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const trigger = root.querySelector<HTMLButtonElement>('.navigation-trigger')!;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.activeElement).toBe(dialog.querySelector('[data-drawer-close]'));
    await vi.waitFor(async () => {
      await fixture.whenStable();
      fixture.detectChanges();
      expect(dialog.querySelector('.account')?.textContent).toContain(
        context.text().examples.email,
      );
    });
    dialog.querySelector<HTMLElement>('.account summary')!.click();
    dialog.querySelector<HTMLButtonElement>('.sign-out')!.click();
    await fixture.whenStable();
    expect(context.destination()).toBe('/backoffice/sign-out');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['loading', 'error'] as const)(
    'recovers the %s account state locally',
    async (scenario) => {
      const { fixture, root, context } = setup('back-office-header', scenario);
      const sidebar = root.querySelector<HTMLElement>('.sidebar')!;
      const i18n = TestBed.inject(I18nService);
      await vi.waitFor(async () => {
        await fixture.whenStable();
        fixture.detectChanges();
        expect(sidebar.querySelector('.account')).toBeNull();
        expect(sidebar.querySelector('.account-status')?.textContent).toContain(
          i18n.t(
            scenario === 'loading'
              ? 'backOfficeShell.accountLoading'
              : 'backOfficeShell.accountUnavailable',
          ),
        );
        expect(sidebar.querySelectorAll('.account-status button')).toHaveLength(
          scenario === 'error' ? 2 : 0,
        );
      });
      expect(context.scenario).toBe(scenario);
      root.querySelector<HTMLButtonElement>('[data-complete-preview]')!.click();
      expect(context.scenario).toBe('ready');
      if (scenario === 'error') {
        const retry = sidebar.querySelector<HTMLButtonElement>('.account-status button')!;
        expect(retry.textContent?.trim()).toBe(i18n.t('backOffice.dashboard.retry'));
        retry.click();
      }
      await vi.waitFor(async () => {
        await fixture.whenStable();
        fixture.detectChanges();
        expect(sidebar.querySelector('.account')?.textContent).toContain(
          context.text().examples.email,
        );
        expect(sidebar.querySelector('.account-status')).toBeNull();
        expect(sidebar.querySelector('.account-details a')).not.toBeNull();
        expect(sidebar.querySelector('.sign-out')).not.toBeNull();
      });
    },
  );

  it('updates active navigation locally and allows no active page', async () => {
    const { fixture, root, context, settings } = setup('back-office-nav');
    expect(root.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    context.navigate('/backoffice/quotes/example');
    await fixture.whenStable();
    expect(root.querySelector('[aria-current="page"]')?.textContent).toContain(
      TestBed.inject(I18nService).t('backOffice.navigation.affairs'),
    );
    fixture.componentRef.setInput('settings', { ...settings, path: '/design/back-office-nav' });
    await fixture.whenStable();
    expect(root.querySelector('[aria-current]')).toBeNull();
    root.querySelector<HTMLAnchorElement>('app-back-office-nav a')!.click();
    await fixture.whenStable();
    expect(context.destination()).toBe('/backoffice/dashboard');
    expect(root.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it('groups document issues and records correction links without navigation', async () => {
    const { fixture, root, context, settings } = setup('document-issues');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    expect(root.querySelectorAll('.party')).toHaveLength(2);
    root.querySelector<HTMLAnchorElement>('.party a')!.click();
    expect(context.destination()).toBe('/backoffice/configuration/entreprise');
    fixture.componentRef.setInput('settings', { ...settings, party: 'client', kind: 'invoice' });
    await fixture.whenStable();
    expect(root.querySelectorAll('.party')).toHaveLength(1);
    expect(root.textContent).toContain(TestBed.inject(I18nService).t('document.invoice.recovery'));
    root.querySelector<HTMLAnchorElement>('.party a')!.click();
    expect(context.destination()).toBe(
      `/backoffice/clients/${context.text().examples.clientId}/profile`,
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('releases pending reads and removes event listeners when the preview is destroyed', async () => {
    const { fixture, root, context } = setup('global-search', 'loading');
    const clients = context.clients();
    const account = context.currentAccount();
    const completed = vi.fn();
    context.events.subscribe({ complete: completed });
    const remove = vi.spyOn(root, 'removeEventListener');
    fixture.destroy();
    expect(await clients).toEqual([]);
    expect(await account).toBeUndefined();
    expect(completed).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith('click', expect.any(Function), true);
    expect(remove).toHaveBeenCalledWith('auxclick', expect.any(Function), true);
  });
});
