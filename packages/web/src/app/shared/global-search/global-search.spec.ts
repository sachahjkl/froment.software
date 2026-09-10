import { Component } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { ClientEditor } from '@app/pages/back-office/client-editor/client-editor';
import { I18nService } from '@app/i18n.service';
import { GlobalSearch } from './global-search';

@Component({ imports: [GlobalSearch], template: '<app-global-search [shortcutEnabled]="true" />' })
class SearchPage {}
@Component({ template: '' })
class DetailPage {}
@Component({
  imports: [GlobalSearch, RouterOutlet],
  template: '<app-global-search [shortcutEnabled]="true" /><router-outlet />',
})
class SearchLayout {}

const client = {
  id: 'client-1',
  displayName: 'Froment Software',
  email: 'hello@example.test',
  city: 'Lyon',
  country: 'France',
};
const quote = {
  id: 'quote-1',
  reference: 'DE-2026-000001',
  title: 'Audit',
  clientDisplayName: 'Froment Software',
};

function escape(element: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    keyCode: 27,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
}

function shortcut(options: KeyboardEventInit = { ctrlKey: true }): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
  return event;
}

function overlay(): HTMLElement {
  return TestBed.inject(OverlayContainer).getContainerElement();
}

async function openSearch(harness: RouterTestingHarness): Promise<HTMLInputElement> {
  harness.routeNativeElement!.querySelector<HTMLButtonElement>('.search-trigger')!.click();
  await harness.fixture.whenStable();
  return overlay().querySelector<HTMLInputElement>('input[type="search"]')!;
}

function search(input: HTMLInputElement, query: string): void {
  input.value = query;
  input.dispatchEvent(new Event('input'));
}

describe('GlobalSearch', () => {
  const clients = vi.fn();
  const quotes = vi.fn();
  const orders = vi.fn();
  const invoices = vi.fn();

  beforeEach(() => {
    clients.mockReset().mockResolvedValue([client]);
    quotes.mockReset().mockResolvedValue([]);
    orders.mockReset().mockResolvedValue([]);
    invoices.mockReset().mockResolvedValue([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: SearchPage },
          { path: 'backoffice/clients/:clientId', component: DetailPage },
        ]),
        { provide: ClientsApi, useValue: { list: clients } },
        { provide: QuotesApi, useValue: { list: quotes } },
        { provide: OrdersApi, useValue: { list: orders } },
        { provide: InvoicesApi, useValue: { list: invoices } },
      ],
    });
  });

  it('keeps references local and leaves shortcuts disabled in standalone previews', async () => {
    TestBed.overrideComponent(SearchPage, {
      set: { template: '<app-global-search /><app-global-search />' },
    });
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    expect(shortcut().defaultPrevented).toBe(false);
    expect(clients).not.toHaveBeenCalled();
    const triggers =
      harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('.search-trigger');
    const ids: string[] = [];
    for (const trigger of triggers) {
      expect(trigger.hasAttribute('aria-controls')).toBe(false);
      trigger.click();
      await harness.fixture.whenStable();
      const dialog = overlay().querySelector<HTMLElement>('[role="dialog"]')!;
      const input = dialog.querySelector<HTMLInputElement>('input')!;
      ids.push(input.id);
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
      expect(dialog.querySelector('label')?.control).toBe(input);
      expect(document.getElementById(input.getAttribute('aria-controls')!)).toBe(
        dialog.querySelector('.results'),
      );
      search(input, 'Froment');
      await harness.fixture.whenStable();
      const group = dialog.querySelector('.results section')!;
      expect(document.getElementById(group.getAttribute('aria-labelledby')!)).toBe(
        group.querySelector('h3'),
      );
      dialog.querySelector<HTMLButtonElement>('.heading button')!.click();
      await harness.fixture.whenStable();
      expect(trigger.hasAttribute('aria-controls')).toBe(false);
      expect(document.activeElement).toBe(trigger);
    }
    expect(new Set(ids).size).toBe(2);
  });

  it('opens one modal with Ctrl+K or Cmd+K, focuses the query, and restores the trigger', async () => {
    const harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    const trigger =
      harness.routeNativeElement!.querySelector<HTMLButtonElement>('.search-trigger')!;
    expect(trigger.getAttribute('aria-keyshortcuts')).toBe('Control+k Meta+k');
    expect(clients).not.toHaveBeenCalled();
    expect(shortcut({ ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(shortcut({ ctrlKey: true, isComposing: true }).defaultPrevented).toBe(false);
    expect(shortcut().defaultPrevented).toBe(true);
    await harness.fixture.whenStable();
    const input = overlay().querySelector<HTMLInputElement>('input')!;
    await vi.waitFor(() => expect(document.activeElement).toBe(input));
    search(input, 'Froment');
    await harness.fixture.whenStable();
    shortcut({ ctrlKey: true, repeat: true });
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(1);
    expect(clients).toHaveBeenCalledTimes(1);
    expect(escape(input).defaultPrevented).toBe(true);
    await harness.fixture.whenStable();
    expect(overlay().querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(shortcut({ metaKey: true }).defaultPrevented).toBe(true);
    await harness.fixture.whenStable();
    expect(overlay().querySelector<HTMLInputElement>('input')!.value).toBe('Froment');
    overlay().querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
    expect(overlay().querySelector('[role="dialog"]')).toBeNull();
  });

  it('keeps a pending query when Escape closes the loading modal', async () => {
    let finish!: (value: (typeof client)[]) => void;
    clients.mockReturnValue(
      new Promise<(typeof client)[]>((resolve) => {
        finish = resolve;
      }),
    );
    const harness = await RouterTestingHarness.create('/');
    const input = await openSearch(harness);
    search(input, 'Froment');
    await harness.fixture.whenStable();
    expect(overlay().querySelector('[role="status"]')?.textContent).toContain(
      TestBed.inject(I18nService).t('backOffice.search.loading'),
    );
    escape(input);
    await harness.fixture.whenStable();
    finish([client]);
    await harness.fixture.whenStable();
    expect(overlay().querySelector('[role="dialog"]')).toBeNull();
    const reopened = await openSearch(harness);
    expect(reopened.value).toBe('Froment');
    expect(overlay().querySelectorAll('.results li')).toHaveLength(1);
  });

  it('focuses the query before retry removes its button and announces delayed results', async () => {
    let finish!: (value: (typeof client)[]) => void;
    const pending = new Promise<(typeof client)[]>((resolve) => {
      finish = resolve;
    });
    clients.mockRejectedValueOnce(new Error('Unavailable')).mockReturnValue(pending);
    const harness = await RouterTestingHarness.create('/');
    const input = await openSearch(harness);
    search(input, 'Froment');
    await harness.fixture.whenStable();
    expect(overlay().querySelector('[role="alert"]')?.textContent).toContain(
      TestBed.inject(I18nService).t('backOffice.search.error'),
    );
    const status = overlay().querySelector('[role="status"]')!;
    const retry = overlay().querySelector<HTMLButtonElement>('.results > button')!;
    retry.focus();
    retry.click();
    expect(document.activeElement).toBe(input);
    await harness.fixture.whenStable();
    expect(retry.isConnected).toBe(false);
    finish([client]);
    await vi.waitFor(async () => {
      await harness.fixture.whenStable();
      expect(overlay().querySelectorAll('.results li')).toHaveLength(1);
    });
    expect(overlay().querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toContain(
      TestBed.inject(I18nService).plural('globalSearch.count', { count: 1 }),
    );
    expect(overlay().querySelector('.results a')?.getAttribute('href')).toBe(
      '/backoffice/clients/client-1',
    );
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Froment');
    expect(clients).toHaveBeenCalledTimes(2);
  });

  it.each(['fr', 'en'] as const)(
    'pluralizes fuzzy results and preserves the empty state in %s',
    async (language) => {
      quotes.mockResolvedValue([quote]);
      const harness = await RouterTestingHarness.create('/');
      TestBed.inject(I18nService).setLanguage(language);
      const input = await openSearch(harness);
      expect(overlay().querySelector('.results')?.textContent).toContain(
        TestBed.inject(I18nService).t('globalSearch.hint'),
      );
      for (const [query, count] of [
        ['Fromant', 2],
        ['Audit', 1],
        ['zzzzzzzz', 0],
      ] as const) {
        search(input, query);
        await harness.fixture.whenStable();
        expect(overlay().querySelectorAll('.results li')).toHaveLength(count);
        expect(overlay().querySelector('[role="status"]')?.textContent).toContain(
          TestBed.inject(I18nService).plural('globalSearch.count', { count }),
        );
      }
      expect(overlay().querySelector('.results')?.textContent).toContain(
        TestBed.inject(I18nService).t('backOffice.search.empty'),
      );
    },
  );

  it('keeps the search and form when the real exit confirmation is cancelled', async () => {
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
      ],
    });
    const harness = await RouterTestingHarness.create('/editor');
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    const name = root.querySelector<HTMLInputElement>('#client-displayName')!;
    name.value = 'Unsaved client';
    name.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    const input = await openSearch(harness);
    search(input, 'Froment');
    await harness.fixture.whenStable();
    const link = overlay().querySelector<HTMLAnchorElement>('.results a')!;
    link.focus();
    link.click();
    await vi.waitFor(() => {
      const cancel = overlay().querySelector<HTMLButtonElement>('[data-confirmation-cancel]');
      expect(cancel).not.toBeNull();
      expect(document.activeElement).toBe(cancel);
    });
    const cancel = overlay().querySelector<HTMLButtonElement>('[data-confirmation-cancel]')!;
    shortcut();
    expect(document.activeElement).toBe(cancel);
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(2);
    cancel.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/editor');
    expect(document.activeElement).toBe(link);
    expect(link.isConnected).toBe(true);
    expect(root.querySelector('#client-displayName')).toBe(name);
    expect(name.value).toBe('Unsaved client');
    expect(input.value).toBe('Froment');
    link.click();
    await vi.waitFor(() => expect(overlay().querySelector('[role="alertdialog"]')).not.toBeNull());
    overlay()
      .querySelector<HTMLButtonElement>(
        '[role="alertdialog"] button:not([data-confirmation-cancel])',
      )!
      .click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/backoffice/clients/client-1');
    expect(overlay().querySelector('.results')).toBeNull();
  });

  it('limits displayed results to five per category', async () => {
    clients.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({ ...client, id: `client-${index}` })),
    );
    quotes.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({ ...quote, id: `quote-${index}` })),
    );
    orders.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({
        ...quote,
        id: `order-${index}`,
        quoteReference: quote.reference,
      })),
    );
    invoices.mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({
        ...quote,
        id: `invoice-${index}`,
        invoiceNumber: `FA-${index}`,
        orderReference: 'CO-1',
      })),
    );
    const harness = await RouterTestingHarness.create('/');
    const input = await openSearch(harness);
    search(input, 'Froment');
    await harness.fixture.whenStable();
    const groups = overlay().querySelectorAll('.results section');
    expect(groups).toHaveLength(4);
    for (const group of groups) expect(group.querySelectorAll('li')).toHaveLength(5);
    expect(overlay().querySelectorAll('.results li')).toHaveLength(20);
  });
});
