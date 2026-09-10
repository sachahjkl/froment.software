import { Component } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { ClientEditor } from '@app/pages/back-office/client-editor/client-editor';
import { I18nService } from '@app/i18n.service';
import { GlobalSearch } from './global-search';

@Component({ imports: [GlobalSearch], template: '<app-global-search />' })
class SearchPage {}
@Component({ template: '' })
class DetailPage {}
@Component({
  imports: [GlobalSearch, RouterOutlet],
  template: '<app-global-search /><router-outlet />',
})
class SearchLayout {}

describe('GlobalSearch', () => {
  it('keeps labels and result references local to each search instance', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: SearchPage }]),
        {
          provide: ClientsApi,
          useValue: {
            list: () =>
              Promise.resolve([
                { id: 'client-1', displayName: 'Froment', email: '', city: '', country: '' },
              ]),
          },
        },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    TestBed.overrideComponent(SearchPage, {
      set: { template: '<app-global-search /><app-global-search />' },
    });
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    const searches = root.querySelectorAll('app-global-search');
    expect(searches).toHaveLength(2);
    for (const search of searches) {
      const input = search.querySelector<HTMLInputElement>('input')!;
      expect(search.querySelector('label')?.control).toBe(input);
      expect(input.hasAttribute('aria-controls')).toBe(false);
      input.value = 'Froment';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(root.querySelectorAll('.results li')).toHaveLength(2);
    });
    const ids = Array.from(root.querySelectorAll('[id]'), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const search of searches) {
      const input = search.querySelector<HTMLInputElement>('input')!;
      expect(document.getElementById(input.getAttribute('aria-controls')!)).toBe(
        search.querySelector('.results'),
      );
      const group = search.querySelector('section[aria-labelledby]')!;
      expect(document.getElementById(group.getAttribute('aria-labelledby')!)).toBe(
        group.querySelector('h2'),
      );
    }
  });

  it.each(['results', 'empty', 'error'] as const)(
    'keeps ARIA references valid when closed, loading, and showing %s',
    async (state) => {
      const clients = [
        {
          id: 'client-1',
          displayName: 'Froment Software',
          email: 'hello@example.test',
          city: 'Lyon',
          country: 'France',
        },
      ];
      let resolve!: (value: typeof clients) => void;
      let reject!: (error: Error) => void;
      const pending = new Promise<typeof clients>((success, failure) => {
        resolve = success;
        reject = failure;
      });
      const list = vi.fn().mockReturnValue(pending);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '', component: SearchPage }]),
          { provide: ClientsApi, useValue: { list } },
          { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
          { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
          { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
        ],
      });
      const harness = await RouterTestingHarness.create('/');
      const fixture = harness.fixture;
      await fixture.whenStable();
      const root = harness.routeNativeElement!;
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
      const expectReferences = (opened: boolean): void => {
        expect(input.getAttribute('aria-controls')).toBe(opened ? `${input.id}-results` : null);
        expect(root.querySelectorAll('.results')).toHaveLength(opened ? 1 : 0);
        for (const element of root.querySelectorAll(
          '[aria-controls], [aria-labelledby], [aria-describedby]',
        )) {
          for (const attribute of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
            const references = element.getAttribute(attribute)?.trim().split(/\s+/) ?? [];
            for (const id of references) {
              expect(id).not.toBe('');
              expect(document.getElementById(id)?.isConnected, `${attribute}=${id}`).toBe(true);
            }
          }
        }
      };
      expect(list).not.toHaveBeenCalled();
      expectReferences(false);
      input.focus();
      input.value = 'Froment';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(root.querySelector('.results > [role="status"]')?.textContent).toBe(
        TestBed.inject(I18nService).t('backOffice.dashboard.loading'),
      );
      expectReferences(true);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();
      expectReferences(false);
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expectReferences(true);
      expect(list).toHaveBeenCalledTimes(1);
      if (state === 'error') reject(new Error('Unavailable'));
      else resolve(state === 'empty' ? [] : clients);
      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(
          root.querySelector(
            state === 'error' ? '.results [role="alert"]' : '.result-heading [role="status"]',
          ),
        ).not.toBeNull();
      });
      expectReferences(true);
      expect(root.querySelectorAll('.results li')).toHaveLength(state === 'results' ? 1 : 0);
      if (state === 'empty')
        expect(root.querySelector('.results')?.textContent).toContain(
          TestBed.inject(I18nService).t('backOffice.search.empty'),
        );
      root.querySelector<HTMLButtonElement>('.result-heading button')!.click();
      await fixture.whenStable();
      expectReferences(false);
      expect(document.activeElement).toBe(input);
    },
  );

  it.each(['loading', 'error', 'empty', 'results'] as const)(
    'keeps the query and focus when Escape closes the %s panel',
    async (state) => {
      const clients = [
        {
          id: 'client-1',
          displayName: 'Froment Software',
          email: 'hello@example.test',
          city: 'Lyon',
          country: 'France',
        },
      ];
      let finish!: (value: typeof clients) => void;
      const pending = new Promise<typeof clients>((resolve) => {
        finish = resolve;
      });
      const list = vi.fn(() => {
        if (state === 'loading') return pending;
        if (state === 'error') return Promise.reject(new Error('Unavailable'));
        return Promise.resolve(state === 'empty' ? [] : clients);
      });
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '', component: SearchPage }]),
          { provide: ClientsApi, useValue: { list } },
          { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
          { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
          { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
        ],
      });
      const harness = await RouterTestingHarness.create('/');
      await harness.fixture.whenStable();
      const root = harness.routeNativeElement!;
      const input = root.querySelector<HTMLInputElement>('input')!;
      const i18n = TestBed.inject(I18nService);
      const origins = [
        'input',
        '.result-heading button',
        ...(state === 'results' ? ['.results a'] : []),
      ];
      for (const origin of origins) {
        input.focus();
        input.value = 'Froment';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await harness.fixture.whenStable();
        expect(root.querySelector('.results')).not.toBeNull();
        expect(root.querySelectorAll('.results li')).toHaveLength(state === 'results' ? 1 : 0);
        if (state === 'loading')
          expect(root.querySelector('.results > [role="status"]')?.textContent).toBe(
            i18n.t('backOffice.dashboard.loading'),
          );
        if (state === 'error')
          expect(root.querySelector('.results [role="alert"]')?.textContent).toBe(
            i18n.t('backOffice.dashboard.error'),
          );
        if (state === 'empty')
          expect(root.querySelector('.result-heading [role="status"]')?.textContent).toBe(
            i18n.plural('globalSearch.count', { count: 0 }),
          );
        for (const key of ['Tab', 'ArrowDown', 'Enter']) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          input.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);
        }
        const target = root.querySelector<HTMLElement>(origin)!;
        target.focus();
        const calls = list.mock.calls.length;
        const escape = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(escape);
        // JSDOM does not implement the native search input clear action.
        expect(escape.defaultPrevented).toBe(true);
        await harness.fixture.whenStable();
        expect(root.querySelector('.results')).toBeNull();
        expect(input.value).toBe('Froment');
        expect(input.hasAttribute('aria-controls')).toBe(false);
        expect(document.activeElement).toBe(input);
        expect(list).toHaveBeenCalledTimes(calls);
      }
      finish(clients);
      await harness.fixture.whenStable();
      expect(root.querySelector('.results')).toBeNull();
      expect(input.value).toBe('Froment');
      expect(document.activeElement).toBe(input);
    },
  );

  it('moves focus before retry removes its button and keeps delayed results open', async () => {
    const clients = [
      {
        id: 'client-1',
        displayName: 'Froment Software',
        email: 'hello@example.test',
        city: 'Lyon',
        country: 'France',
      },
    ];
    let finish!: (value: typeof clients) => void;
    const pending = new Promise<typeof clients>((resolve) => {
      finish = resolve;
    });
    const list = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockReturnValue(pending);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: SearchPage }]),
        { provide: ClientsApi, useValue: { list } },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    const input = root.querySelector<HTMLInputElement>('input')!;
    input.focus();
    input.value = 'Froment';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(root.querySelector('.results [role="alert"]')).not.toBeNull();
    const retry = root.querySelector<HTMLButtonElement>('.results > button')!;
    retry.focus();
    expect(document.activeElement).toBe(retry);
    retry.click();
    expect(document.activeElement).toBe(input);
    await harness.fixture.whenStable();
    expect(retry.isConnected).toBe(false);
    expect(root.querySelector('.results > [role="status"]')?.textContent).toBe(
      TestBed.inject(I18nService).t('backOffice.dashboard.loading'),
    );
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Froment');
    finish(clients);
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(root.querySelectorAll('.results li')).toHaveLength(1);
    });
    expect(root.querySelector('.results a')?.getAttribute('href')).toBe(
      '/backoffice/clients/client-1',
    );
    expect(root.querySelector('.result-heading [role="status"]')?.textContent).toBe(
      TestBed.inject(I18nService).plural('globalSearch.count', { count: 1 }),
    );
    expect(document.activeElement).toBe(input);
    expect(list).toHaveBeenCalledTimes(2);
    input.blur();
    await harness.fixture.whenStable();
    expect(root.querySelector('.results')).toBeNull();
  });

  it.each([
    {
      language: 'fr',
      empty: '0 résultat affiché',
      one: '1 résultat affiché',
      other: '2 résultats affichés',
      limit: 'Maximum : 5 par catégorie.',
    },
    {
      language: 'en',
      empty: '0 displayed results',
      one: '1 displayed result',
      other: '2 displayed results',
      limit: 'Maximum: 5 per category.',
    },
  ] as const)(
    'pluralizes zero, one, and two displayed results in $language',
    async ({ language, empty, one, other, limit }) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '', component: SearchPage }]),
          {
            provide: ClientsApi,
            useValue: {
              list: () =>
                Promise.resolve([
                  {
                    id: 'client-1',
                    displayName: 'Froment Software',
                    email: 'hello@example.test',
                    city: 'Lyon',
                    country: 'France',
                  },
                ]),
            },
          },
          {
            provide: QuotesApi,
            useValue: {
              list: () =>
                Promise.resolve([
                  {
                    id: 'quote-1',
                    reference: 'DE-2026-000001',
                    title: 'Audit',
                    clientDisplayName: 'Froment Software',
                  },
                ]),
            },
          },
          { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
          { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
        ],
      });
      const harness = await RouterTestingHarness.create('/');
      await harness.fixture.whenStable();
      TestBed.inject(I18nService).setLanguage(language);
      const root = harness.routeNativeElement!;
      const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.focus();
      for (const [query, count, label] of [
        ['Froment', 2, other],
        ['Audit', 1, one],
        ['zzzzzzzz', 0, empty],
      ] as const) {
        input.value = query;
        input.dispatchEvent(new Event('input'));
        await harness.fixture.whenStable();
        expect(root.querySelectorAll('.results li')).toHaveLength(count);
        expect(root.querySelector('.result-heading [role="status"]')?.textContent).toBe(
          `${label} · ${limit}`,
        );
      }
    },
  );

  it('keeps the result link and form fields when the real exit confirmation is cancelled', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: SearchLayout,
            children: [
              { path: 'editor', component: ClientEditor, canDeactivate: [unsavedChangesGuard] },
              { path: 'backoffice/clients/:clientId', component: DetailPage },
            ],
          },
        ]),
        {
          provide: ClientsApi,
          useValue: {
            list: () =>
              Promise.resolve([
                {
                  id: 'client-1',
                  displayName: 'Froment Software',
                  email: 'hello@example.test',
                  city: 'Lyon',
                  country: 'France',
                },
              ]),
          },
        },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const harness = await RouterTestingHarness.create('/editor');
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    const name = root.querySelector<HTMLInputElement>('#client-displayName')!;
    name.value = 'Unsaved client';
    name.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.focus();
    input.value = 'Froment';
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    const link = root.querySelector<HTMLAnchorElement>('.results a')!;
    link.focus();
    link.click();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await vi.waitFor(() => {
      const cancel = overlay.querySelector<HTMLButtonElement>('[data-confirmation-cancel]');
      expect(cancel).not.toBeNull();
      expect(document.activeElement).toBe(cancel);
    });
    expect(root.querySelector('.results a')).toBe(link);
    expect(name.value).toBe('Unsaved client');
    overlay.querySelector<HTMLButtonElement>('[data-confirmation-cancel]')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/editor');
    expect(document.activeElement).toBe(link);
    expect(link.isConnected).toBe(true);
    expect(root.querySelector('#client-displayName')).toBe(name);
    expect(name.value).toBe('Unsaved client');
    expect(input.value).toBe('Froment');

    link.click();
    await vi.waitFor(() => expect(overlay.querySelector('[role="alertdialog"]')).not.toBeNull());
    expect(root.querySelector('.results a')).toBe(link);
    overlay.querySelector<HTMLButtonElement>('button:not([data-confirmation-cancel])')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/backoffice/clients/client-1');
    expect(root.querySelector('.results')).toBeNull();
  });

  it.each(['fr', 'en'] as const)(
    'counts twenty displayed results with five per category in %s',
    async (language) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ path: '', component: SearchPage }]),
          {
            provide: ClientsApi,
            useValue: {
              list: () =>
                Promise.resolve(
                  Array.from({ length: 7 }, (_, index) => ({
                    id: `client-${index}`,
                    displayName: `Froment ${index}`,
                    email: 'hello@example.test',
                    city: 'Lyon',
                    country: 'France',
                  })),
                ),
            },
          },
          {
            provide: QuotesApi,
            useValue: {
              list: () =>
                Promise.resolve(
                  Array.from({ length: 7 }, (_, index) => ({
                    id: `quote-${index}`,
                    reference: `DE-${index}`,
                    title: 'Audit',
                    clientDisplayName: 'Froment Software',
                  })),
                ),
            },
          },
          {
            provide: OrdersApi,
            useValue: {
              list: () =>
                Promise.resolve(
                  Array.from({ length: 7 }, (_, index) => ({
                    id: `order-${index}`,
                    reference: `CO-${index}`,
                    quoteReference: `DE-${index}`,
                    title: 'Audit',
                    clientDisplayName: 'Froment Software',
                  })),
                ),
            },
          },
          {
            provide: InvoicesApi,
            useValue: {
              list: () =>
                Promise.resolve(
                  Array.from({ length: 7 }, (_, index) => ({
                    id: `invoice-${index}`,
                    invoiceNumber: `FA-${index}`,
                    orderReference: `CO-${index}`,
                    title: 'Audit',
                    clientDisplayName: 'Froment Software',
                  })),
                ),
            },
          },
        ],
      });
      const harness = await RouterTestingHarness.create('/');
      await harness.fixture.whenStable();
      TestBed.inject(I18nService).setLanguage(language);
      const root = harness.routeNativeElement!;
      const input = root.querySelector<HTMLInputElement>('input')!;
      input.focus();
      input.value = 'Froment';
      input.dispatchEvent(new Event('input'));
      await harness.fixture.whenStable();
      const groups = root.querySelectorAll('.results section');
      expect(groups).toHaveLength(4);
      for (const [index, kind] of (['client', 'quote', 'order', 'invoice'] as const).entries()) {
        const group = groups[index]!;
        expect(group.querySelector('h2')?.textContent).toBe(
          TestBed.inject(I18nService).t(`backOffice.search.kind.${kind}`),
        );
        expect(group.querySelectorAll('li')).toHaveLength(5);
      }
      expect(root.querySelectorAll('.results li')).toHaveLength(20);
      expect(root.querySelector('.result-heading [role="status"]')?.textContent).toBe(
        language === 'fr'
          ? '20 résultats affichés · Maximum : 5 par catégorie.'
          : '20 displayed results · Maximum: 5 per category.',
      );
    },
  );

  it('loads on demand, groups fuzzy results, closes with Escape, and opens a detail route', async () => {
    const list = vi.fn().mockResolvedValue([
      {
        id: 'client-1',
        displayName: 'Froment Software',
        email: 'hello@example.test',
        city: 'Lyon',
        country: 'France',
      },
    ]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: SearchPage },
          { path: 'backoffice/clients/:clientId', component: DetailPage },
        ]),
        { provide: ClientsApi, useValue: { list } },
        {
          provide: QuotesApi,
          useValue: {
            list: () =>
              Promise.resolve([
                {
                  id: 'quote-1',
                  reference: 'DE-2026-000001',
                  title: 'Audit',
                  clientDisplayName: 'Froment Software',
                },
              ]),
          },
        },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    expect(list).not.toHaveBeenCalled();
    const root = harness.routeNativeElement!;
    const input = root.querySelector<HTMLInputElement>('input')!;
    input.focus();
    input.value = 'Fromant';
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(root.querySelectorAll('.results section')).toHaveLength(2);
    expect(root.querySelector('h2[id$="-client"] + ul a')?.textContent).toContain('Froment');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await harness.fixture.whenStable();
    expect(root.querySelector('.results')).toBeNull();
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    root.querySelector<HTMLAnchorElement>('.results a')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/backoffice/clients/client-1');
  });
});
