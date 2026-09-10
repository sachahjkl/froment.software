import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { TableExport } from '@shared/table-export/table-export';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { ClientDetail } from '../client-detail/client-detail';
import { Clients } from './clients';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';

const client = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  displayName: 'Développement Acme',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: 'Lyon',
  country: 'France',
  email: 'contact@acme.example',
  archived: false,
  updatedAt: 1,
};
const archivedClient = {
  ...client,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  displayName: 'Archived',
  archived: true,
};

async function configure(
  list = vi.fn().mockResolvedValue([client, archivedClient]),
  url = '/backoffice/clients/active',
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'backoffice/clients',
          component: Clients,
          children: ['active', 'archived', 'all'].map((tab) => ({
            path: tab,
            component: TabPanelOutlet,
            data: { panel: 'clients', tab },
          })),
        },
        {
          path: 'backoffice/clients/:clientId',
          component: ClientDetail,
          children: [
            { path: '', redirectTo: 'profile', pathMatch: 'full' },
            ...['profile', 'affairs', 'documents', 'access'].map((path) => ({
              path,
              component: TabPanelOutlet,
              data: { panel: path },
            })),
          ],
        },
      ]),
      {
        provide: ClientsApi,
        useValue: {
          list,
          get: () => Promise.resolve({ success: true, result: client }),
          listAccess: () => Promise.resolve({ success: true, result: [] }),
        },
      },
      { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return { harness, fixture: harness.fixture, root: harness.fixture.nativeElement as HTMLElement };
}

describe('Clients', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
  });
  afterEach(() => scrolling.restore());

  it.each([
    { language: 'fr', empty: '0 client', one: '1 client', other: '2 clients' },
    { language: 'en', empty: '0 clients', one: '1 client', other: '2 clients' },
  ] as const)(
    'pluralizes zero, one, and two filtered clients in $language',
    async ({ language, empty, one, other }) => {
      const { root, fixture, harness } = await configure(undefined, '/backoffice/clients/all');
      TestBed.inject(I18nService).setLanguage(language);
      for (const [query, count, label] of [
        ['', 2, other],
        ['?q=developement', 1, one],
        ['?q=zzzzzzzz', 0, empty],
      ] as const) {
        await harness.navigateByUrl(`/backoffice/clients/all${query}`);
        await fixture.whenStable();
        expect(root.querySelectorAll('tbody tr')).toHaveLength(count);
        expect(root.querySelector('footer.list-summary [role="status"]')?.textContent?.trim()).toBe(
          label,
        );
      }
    },
  );

  it('sorts raw dates, countries, and names and exports the sorted rows', async () => {
    const records = [
      {
        ...client,
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        displayName: 'École 10',
        country: 'France',
        updatedAt: Date.parse('2026-01-21T08:00:00Z'),
      },
      {
        ...client,
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        displayName: 'École 2',
        country: 'Allemagne',
        updatedAt: Date.parse('2026-02-01T08:00:00Z'),
      },
      {
        ...client,
        displayName: 'Ecole 2',
        country: 'États-Unis',
        updatedAt: Date.parse('2026-01-21T08:00:00Z'),
      },
    ];
    const { root, fixture, harness } = await configure(vi.fn().mockResolvedValue(records));
    TestBed.inject(I18nService).setLanguage('fr');
    await fixture.whenStable();
    const names = () => Array.from(root.querySelectorAll('tbody th a'), (link) => link.textContent);
    expect(names()).toEqual(['Ecole 2', 'École 2', 'École 10']);
    const buttons = root.querySelectorAll<HTMLButtonElement>('thead [appTableSort]');
    expect(buttons).toHaveLength(3);
    expect(root.querySelectorAll('thead th[aria-sort]')).toHaveLength(1);
    expect(buttons.item(0).parentElement?.getAttribute('aria-sort')).toBe('ascending');
    buttons.item(0).click();
    await fixture.whenStable();
    expect(names()).toEqual(['École 10', 'Ecole 2', 'École 2']);
    expect(TestBed.inject(Router).url).toContain('sort=name-desc');
    buttons.item(1).click();
    await fixture.whenStable();
    expect(names()).toEqual(['École 2', 'Ecole 2', 'École 10']);
    expect(buttons.item(0).parentElement?.hasAttribute('aria-sort')).toBe(false);
    buttons.item(2).click();
    await fixture.whenStable();
    expect(names()).toEqual(['Ecole 2', 'École 10', 'École 2']);
    buttons.item(2).click();
    await fixture.whenStable();
    expect(names()).toEqual(['École 2', 'Ecole 2', 'École 10']);
    expect(root.querySelectorAll('thead th[aria-sort]')).toHaveLength(1);
    expect(buttons.item(2).parentElement?.getAttribute('aria-sort')).toBe('descending');
    expect(root.querySelector('tbody time')?.getAttribute('datetime')).toBe(
      '2026-02-01T08:00:00.000Z',
    );
    const exporter = fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exporter.columns()).toHaveLength(6);
    expect(exporter.rows().map((row) => row[0])).toEqual(names());
    expect(exporter.rows().every((row) => row.length === 6)).toBe(true);
    expect(exporter.filename()).toBe('clients.csv');
    await harness.navigateByUrl('/backoffice/clients/active?sort=unknown');
    await fixture.whenStable();
    expect(names()).toEqual(['Ecole 2', 'École 2', 'École 10']);
    expect(buttons.item(0).parentElement?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('keeps sorting with Fuse filters and restores the list through real detail tabs', async () => {
    const { root, fixture } = await configure(
      undefined,
      '/backoffice/clients/all?q=developement&country=France&contact=incomplete&sort=date-desc',
    );
    const router = TestBed.inject(Router);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    const exporter = fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exporter.rows()).toHaveLength(1);
    expect(exporter.rows()[0]![0]).toBe(client.displayName);
    root.querySelector<HTMLAnchorElement>('tbody a')!.click();
    await fixture.whenStable();
    const query = {
      q: 'developement',
      country: 'France',
      contact: 'incomplete',
      sort: 'date-desc',
      view: 'all',
    };
    expect(router.parseUrl(router.url).queryParams).toEqual(query);
    root.querySelector<HTMLAnchorElement>('#client-documents-tab')!.click();
    await fixture.whenStable();
    expect(router.parseUrl(router.url).queryParams).toEqual(query);
    root.querySelector<HTMLAnchorElement>('.client-page > a')!.click();
    await fixture.whenStable();
    expect(router.url).toBe(
      '/backoffice/clients/all?q=developement&country=France&contact=incomplete&sort=date-desc',
    );
    expect(root.querySelector('thead th[aria-sort]')?.textContent).toMatch(/modification|modified/);
    root.querySelector<HTMLButtonElement>('.filter-chips > button:last-child')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/backoffice/clients/all?sort=date-desc');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(document.activeElement).toBe(root.querySelector('app-list-search input'));
  });

  it('searches category choices and commits filters without changing the sort', async () => {
    const { root, fixture } = await configure(
      vi.fn().mockResolvedValue([
        client,
        {
          ...client,
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          displayName: 'Autre',
          country: 'Belgique',
        },
      ]),
      '/backoffice/clients/active?sort=date-desc',
    );
    const i18n = TestBed.inject(I18nService);
    const router = TestBed.inject(Router);
    const trigger = root.querySelector<HTMLButtonElement>('app-filter-menu > button')!;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(dialog.querySelector('input, select')).toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
    dialog.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await fixture.whenStable();
    let choice = dialog.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(choice.getAttribute('aria-label')).toBe(i18n.t('listWorkspace.searchChoices'));
    expect(document.activeElement).toBe(choice);
    choice.value = 'zzzzzzzz';
    choice.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(dialog.querySelector('[role="status"]')?.textContent).toBe(
      i18n.t('listWorkspace.noChoices'),
    );
    pressKey(choice, 'Enter');
    await fixture.whenStable();
    expect(router.url).toBe('/backoffice/clients/active?sort=date-desc');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    dialog.querySelector<HTMLButtonElement>('.back')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
    dialog.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await fixture.whenStable();
    choice = dialog.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(choice.value).toBe('');
    choice.value = 'france';
    choice.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(router.url).toBe('/backoffice/clients/active?sort=date-desc');
    pressKey(choice, 'End');
    await fixture.whenStable();
    pressKey(choice, 'Enter');
    await fixture.whenStable();
    expect(router.url).toBe('/backoffice/clients/active?country=France&sort=date-desc');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody a')?.textContent).toBe(client.displayName);
    expect(trigger.getAttribute('aria-label')).toMatch(/\(1\)/);
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await fixture.whenStable();
    const categories = document.querySelectorAll<HTMLElement>('[role="dialog"] [role="menuitem"]');
    expect(categories.item(0).textContent).toContain('France');
    categories.item(1).click();
    await fixture.whenStable();
    choice = document.querySelector<HTMLInputElement>('[role="dialog"] [role="combobox"]')!;
    pressKey(choice, 'End');
    await fixture.whenStable();
    pressKey(choice, 'Enter');
    await fixture.whenStable();
    expect(router.url).toBe(
      '/backoffice/clients/active?country=France&contact=incomplete&sort=date-desc',
    );
    expect(trigger.getAttribute('aria-label')).toMatch(/\(2\)/);
    trigger.click();
    await fixture.whenStable();
    document.querySelectorAll<HTMLElement>('[role="dialog"] [role="menuitem"]').item(1).click();
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"] [aria-selected="true"]')?.textContent).toContain(
      i18n.t('clientsWorkspace.contactIncomplete'),
    );
    pressKey(
      document.querySelector<HTMLElement>('[role="dialog"] [role="combobox"]')!,
      'Escape',
      27,
    );
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
    expect(router.url).toBe(
      '/backoffice/clients/active?country=France&contact=incomplete&sort=date-desc',
    );
    expect(root.querySelector('app-list-search label')?.textContent?.trim()).not.toBe('');
    expect(root.querySelector('[appListWorkspace]')).not.toBeNull();
  });

  it('restores country and incomplete contact filters from the URL', async () => {
    const complete = {
      ...client,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      displayName: 'Complete',
      addressLine1: '1 rue Principale',
      postalCode: '69001',
    };
    const { root, fixture, harness } = await configure(
      vi.fn().mockResolvedValue([client, complete]),
      '/backoffice/clients/active?country=France&contact=incomplete',
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody')?.textContent).toContain(client.displayName);
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(2);
    root.querySelector<HTMLButtonElement>('[appFilterChip]')!.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/backoffice/clients/active?contact=incomplete');
    await harness.navigateByUrl('/backoffice/clients/active?country=France');
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('separates creation from the list and links clients to their details', async () => {
    const { root } = await configure();
    expect(root.querySelector('dialog, form')).toBeNull();
    expect(root.querySelector('app-page-header a')?.getAttribute('href')).toBe(
      '/backoffice/clients/new',
    );
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
      `/backoffice/clients/${client.id}`,
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('combines tabs and fuzzy search across contact details', async () => {
    const { root, fixture } = await configure();
    const search = root.querySelector<HTMLInputElement>('app-list-search input')!;
    search.value = 'developement';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(root.querySelector('tbody')?.textContent).toContain(client.displayName);
    root.querySelector<HTMLAnchorElement>('#clients-archived-tab')!.click();
    await fixture.whenStable();
    expect(root.querySelector('tbody')).toBeNull();
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('app-empty-state button')!.click();
    await fixture.whenStable();
    expect(root.querySelector('tbody')?.textContent).toContain('Archived');
  });

  it('shows loading and failure states with an explicit retry', async () => {
    let reject!: (error: Error) => void;
    const list = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue([]);
    const { root, fixture } = await configure(list);
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/Loading|Chargement/);
    reject(new Error('Unavailable'));
    await fixture.whenStable();
    await vi.waitFor(() => expect(root.querySelector('[role="alert"]')).not.toBeNull());
    root.querySelector<HTMLButtonElement>('.notice-flow button')!.click();
    await fixture.whenStable();
    expect(list).toHaveBeenCalledTimes(2);
    expect(root.querySelector('app-empty-state')).not.toBeNull();
  });
});
