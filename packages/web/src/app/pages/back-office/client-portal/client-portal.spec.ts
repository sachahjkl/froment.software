import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { ClientPortalApi } from '@backoffice/client-portal-api';
import { I18nService } from '@app/i18n.service';
import { TableExport } from '@shared/table-export/table-export';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { CustomerDocumentDetail } from '../customer-document-detail/customer-document-detail';
import { ClientPortal } from './client-portal';
import { ClientPortalApiStub, invoiceId, orderId, quoteId } from './portal.spec-helper';

async function configure(url = '/backoffice/client', api = new ClientPortalApiStub()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'backoffice/client', component: ClientPortal },
        {
          path: 'backoffice/client/documents/:kind/:documentId',
          component: CustomerDocumentDetail,
        },
      ]),
      { provide: ClientPortalApi, useValue: api },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return { harness, root: harness.routeNativeElement!, api };
}

async function returnToPortal(harness: RouterTestingHarness): Promise<void> {
  const navigation = firstValueFrom(
    TestBed.inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd)),
  );
  harness.routeNativeElement!.querySelector<HTMLAnchorElement>('.document-page > a')!.click();
  await navigation;
  harness.detectChanges();
  await vi.waitFor(async () => {
    await harness.fixture.whenStable();
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(ClientPortal);
    expect(
      harness.routeNativeElement!.querySelector('footer.list-summary [role="status"]'),
    ).not.toBeNull();
  });
}

async function openChoicePanel(harness: RouterTestingHarness, label: string): Promise<Element> {
  harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-filter-menu > button')!.click();
  await harness.fixture.whenStable();
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
  expect(dialog.querySelector('input, select')).toBeNull();
  Array.from(dialog.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    .find((item) => item.querySelector('.category-label')?.textContent === label)!
    .click();
  await harness.fixture.whenStable();
  expect(document.activeElement).toBe(dialog.querySelector('[role="combobox"]'));
  return dialog;
}

describe('ClientPortal', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
  });
  afterEach(() => scrolling.restore());

  it.each([
    { language: 'fr', empty: '0 document', one: '1 document', other: '2 documents' },
    { language: 'en', empty: '0 documents', one: '1 document', other: '2 documents' },
  ] as const)(
    'pluralizes zero, one, and two filtered documents in $language',
    async ({ language, empty, one, other }) => {
      const api = new ClientPortalApiStub();
      api.orders = [];
      const { root, harness } = await configure('/backoffice/client', api);
      TestBed.inject(I18nService).setLanguage(language);
      for (const [query, count, label] of [
        ['', 2, other],
        ['?kind=quote', 1, one],
        ['?kind=order', 0, empty],
      ] as const) {
        await harness.navigateByUrl(`/backoffice/client${query}`);
        await harness.fixture.whenStable();
        expect(root.querySelectorAll('tbody tr')).toHaveLength(count);
        expect(root.querySelector('footer.list-summary [role="status"]')?.textContent?.trim()).toBe(
          label,
        );
      }
    },
  );

  it('sorts cents and raw dates and exports the filtered rows in that order', async () => {
    const api = new ClientPortalApiStub();
    api.quotes = [{ ...api.quotes[0]!, totalCents: 900, updatedAt: '2026-02-01T08:00:00.000Z' }];
    api.orders = [{ ...api.orders[0]!, totalCents: 12000, createdAt: '2026-01-21T08:00:00.000Z' }];
    api.invoices = [
      {
        ...api.invoices[0]!,
        totalCents: 2500,
        recordedPaidCents: 1000,
        remainingCents: 1500,
        updatedAt: '2026-01-30T08:00:00.000Z',
      },
    ];
    const { root, harness } = await configure('/backoffice/client', api);
    const ids = () => Array.from(root.querySelectorAll('tbody tr'), (row) => row.id);
    const quote = `client-quote-${quoteId}`;
    const order = `client-order-${orderId}`;
    const invoice = `client-invoice-${invoiceId}`;
    expect(ids()).toEqual([quote, invoice, order]);
    const buttons = root.querySelectorAll<HTMLButtonElement>('thead [appTableSort]');
    expect(buttons).toHaveLength(5);
    expect(buttons.item(3).parentElement?.getAttribute('aria-sort')).toBe('descending');
    buttons.item(4).click();
    await harness.fixture.whenStable();
    expect(ids()).toEqual([quote, invoice, order]);
    buttons.item(4).click();
    await harness.fixture.whenStable();
    expect(ids()).toEqual([order, invoice, quote]);
    const exporter = harness.fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exporter.columns()).toHaveLength(7);
    expect(exporter.rows().map((row) => row[5])).toEqual([120, 25, 9]);
    expect(exporter.rows().map((row) => row[6])).toEqual([null, 15, null]);
    expect(exporter.rows().every((row) => row.length === 7)).toBe(true);
    buttons.item(3).click();
    await harness.fixture.whenStable();
    expect(ids()).toEqual([order, invoice, quote]);
    buttons.item(3).click();
    await harness.fixture.whenStable();
    expect(ids()).toEqual([quote, invoice, order]);
    buttons.item(0).click();
    await harness.fixture.whenStable();
    expect(ids()).toEqual([order, quote, invoice]);
    expect(root.querySelectorAll('thead th[aria-sort]')).toHaveLength(1);
    const search = root.querySelector<HTMLInputElement>('app-list-search input')!;
    search.value = 'FA-2026-000001';
    search.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    const i18n = TestBed.inject(I18nService);
    const dialog = await openChoicePanel(harness, i18n.t('portalWorkspace.kind'));
    Array.from(dialog.querySelectorAll<HTMLElement>('[role="option"]'))
      .find((option) => option.textContent?.trim() === i18n.t('backOffice.search.kind.invoice'))!
      .click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(exporter.rows()).toHaveLength(1);
    expect(exporter.rows()[0]![0]).toBe('FA-2026-000001');
    expect(TestBed.inject(Router).url).toContain('sort=reference-asc');
    root.querySelector<HTMLButtonElement>('.filter-chips > button:last-child')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/backoffice/client?sort=reference-asc');
    expect(document.activeElement).toBe(search);
  });

  it('compares translated types and statuses with the active language collator', async () => {
    const { root, harness } = await configure();
    const i18n = TestBed.inject(I18nService);
    const router = TestBed.inject(Router);
    const records = [
      {
        id: `client-quote-${quoteId}`,
        kind: 'backOffice.search.kind.quote',
        status: 'backOffice.quote.status.accepted',
      },
      {
        id: `client-order-${orderId}`,
        kind: 'backOffice.search.kind.order',
        status: 'backOffice.client.confirmed',
      },
      {
        id: `client-invoice-${invoiceId}`,
        kind: 'backOffice.search.kind.invoice',
        status: 'backOffice.invoice.status.issued',
      },
    ] as const;
    for (const column of ['kind', 'status'] as const) {
      await router.navigateByUrl(`/backoffice/client?sort=${column}-asc`);
      for (const language of ['fr', 'en'] as const) {
        i18n.setLanguage(language);
        await harness.fixture.whenStable();
        const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
        expect(Array.from(root.querySelectorAll('tbody tr'), (row) => row.id)).toEqual(
          records
            .toSorted((left, right) =>
              collator.compare(i18n.t(left[column]), i18n.t(right[column])),
            )
            .map(({ id }) => id),
        );
      }
    }
  });

  it('uses an identifier tie break in both directions and rejects unknown sorts', async () => {
    const { root, harness } = await configure('/backoffice/client?sort=unknown');
    const ids = () => Array.from(root.querySelectorAll('tbody tr'), (row) => row.id);
    const expected = [
      `client-quote-${quoteId}`,
      `client-invoice-${invoiceId}`,
      `client-order-${orderId}`,
    ];
    expect(ids()).toEqual(expected);
    for (const sort of ['amount-asc', 'amount-desc', 'date-asc', 'date-desc']) {
      await harness.navigateByUrl(`/backoffice/client?sort=${sort}`);
      await harness.fixture.whenStable();
      expect(ids()).toEqual(expected);
    }
  });

  it('restores URL filters and opens a focused detail with a return link', async () => {
    const { root, harness } = await configure(
      '/backoffice/client?kind=invoice&status=open&q=Security&sort=amount-asc',
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody')?.textContent).toContain('FA-2026-000001');
    expect(root.querySelector('tbody')?.textContent).toMatch(/90[,.]00/);
    expect(root.querySelector('a[download]')).toBeNull();
    root.querySelector<HTMLAnchorElement>('tbody a')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain(
      `/backoffice/client/documents/invoice/${invoiceId}`,
    );
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
      q: 'Security',
      kind: 'invoice',
      status: 'open',
      sort: 'amount-asc',
    });
    await returnToPortal(harness);
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
      q: 'Security',
      kind: 'invoice',
      status: 'open',
      sort: 'amount-asc',
    });
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(
      harness.routeNativeElement!.querySelector<HTMLInputElement>('app-list-search input')?.value,
    ).toBe('Security');
    const i18n = TestBed.inject(I18nService);
    for (const [category, selected] of [
      [i18n.t('portalWorkspace.kind'), i18n.t('backOffice.search.kind.invoice')],
      [i18n.t('portalWorkspace.status'), i18n.t('portalWorkspace.open')],
    ] as const) {
      const dialog = await openChoicePanel(harness, category);
      expect(dialog.querySelector('[aria-selected="true"]')?.textContent?.trim()).toBe(selected);
      dialog.querySelector<HTMLButtonElement>('.close')!.click();
      await harness.fixture.whenStable();
    }
    expect(
      harness.routeNativeElement!.querySelector('thead th[aria-sort]')?.getAttribute('aria-sort'),
    ).toBe('ascending');
  });

  it('keeps choice searches local and translates categories before an explicit commit', async () => {
    const url = '/backoffice/client?q=Security&sort=amount-desc';
    const { root, harness, api } = await configure(url);
    const i18n = TestBed.inject(I18nService);
    const router = TestBed.inject(Router);
    i18n.setLanguage('fr');
    await harness.fixture.whenStable();
    const dialog = await openChoicePanel(harness, i18n.t('portalWorkspace.status'));
    const choice = dialog.querySelector<HTMLInputElement>('[role="combobox"]')!;
    choice.value = 'zzzzzzzz';
    choice.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(dialog.querySelector('[role="status"]')?.textContent).toBe(
      i18n.t('listWorkspace.noChoices'),
    );
    pressKey(choice, 'Enter');
    await harness.fixture.whenStable();
    expect(router.url).toBe(url);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    dialog.querySelector<HTMLButtonElement>('.back')!.click();
    await harness.fixture.whenStable();
    const category = dialog.querySelectorAll<HTMLElement>('[role="menuitem"]').item(1);
    expect(document.activeElement).toBe(category);
    expect(category.textContent).toContain(i18n.t('portalWorkspace.allStatuses'));
    category.click();
    await harness.fixture.whenStable();
    const search = dialog.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(search.value).toBe('');
    i18n.setLanguage('en');
    await harness.fixture.whenStable();
    expect(dialog.querySelector('h2')?.textContent).toBe('Status');
    expect(search.getAttribute('aria-label')).toBe(i18n.t('listWorkspace.searchChoices'));
    expect(dialog.querySelector('[aria-selected="true"]')?.textContent?.trim()).toBe(
      'All statuses',
    );
    search.value = 'In progress';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(router.url).toBe(url);
    pressKey(search, 'Escape', 27);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('app-filter-menu > button'));
    expect(router.url).toBe(url);
    const reopened = await openChoicePanel(harness, i18n.t('portalWorkspace.status'));
    Array.from(reopened.querySelectorAll<HTMLElement>('[role="option"]'))
      .find((option) => option.textContent?.trim() === 'In progress')!
      .click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/backoffice/client?q=Security&status=open&sort=amount-desc');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('app-filter-menu > button'));
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody a')?.textContent).toBe('FA-2026-000001');
    expect(api.calls).toBe(1);
  });

  it('preserves only the list filters through a direct detail URL and related documents', async () => {
    const { harness } = await configure(
      `/backoffice/client/documents/invoice/${invoiceId}?kind=invoice&status=open&q=Security&sort=reference-desc&unrelated=value`,
    );
    const router = TestBed.inject(Router);
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('.related a')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toContain(`/backoffice/client/documents/order/${orderId}`);
    expect(router.parseUrl(router.url).queryParams).toEqual({
      q: 'Security',
      kind: 'invoice',
      status: 'open',
      sort: 'reference-desc',
    });
    await returnToPortal(harness);
    expect(router.url).toBe(
      '/backoffice/client?q=Security&kind=invoice&status=open&sort=reference-desc',
    );
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(harness.routeNativeElement!.querySelector('tbody a')?.textContent).toBe(
      'FA-2026-000001',
    );
  });

  it('updates return filters when the URL changes without replacing the document page', async () => {
    const { harness } = await configure(
      `/backoffice/client/documents/invoice/${invoiceId}?kind=invoice`,
    );
    await harness.navigateByUrl(
      `/backoffice/client/documents/invoice/${invoiceId}?kind=quote&status=completed&q=Security&sort=status-asc`,
    );
    await harness.fixture.whenStable();
    await returnToPortal(harness);
    expect(TestBed.inject(Router).url).toBe(
      '/backoffice/client?q=Security&kind=quote&status=completed&sort=status-asc',
    );
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(harness.routeNativeElement!.querySelector('tbody a')?.textContent).toBe(
      'DE-2026-000001',
    );
  });

  it('focuses the document selected by an authenticated permalink', async () => {
    const { root } = await configure(`/backoffice/client?order=${orderId}`);
    const row = root.querySelector<HTMLElement>(`#client-order-${orderId}`)!;
    expect(row.classList.contains('target-document')).toBe(true);
    expect(row.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(row);
  });

  it('shows an error and retries document loading without a provider action', async () => {
    const api = new ClientPortalApiStub();
    api.fail = true;
    const { root, harness } = await configure('/backoffice/client', api);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    api.fail = false;
    root.querySelector<HTMLButtonElement>('.state button')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(api.calls).toBe(2);
  });
});
