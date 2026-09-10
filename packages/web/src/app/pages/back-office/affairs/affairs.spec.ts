import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';
import { vi } from 'vitest';

import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { Affairs } from './affairs';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';
import { TableExport } from '@shared/table-export/table-export';
import { serializeCsv } from '@shared/table-export/csv';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { control, inputValue, labelControl } from '../quote-detail/commercial.spec-helper';

function searchControl(root: ParentNode): HTMLInputElement {
  return labelControl<HTMLInputElement>(root, TestBed.inject(I18nService).t('commercial.search'));
}
function setSearch(root: ParentNode, value: string): void {
  const input = searchControl(root);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function filterItem(role: 'menuitem' | 'option', label: string): HTMLElement {
  const item = Array.from(
    document.querySelectorAll<HTMLElement>(`[role="dialog"] [role="${role}"]`),
  ).find((element) =>
    role === 'menuitem'
      ? element.textContent?.trim().startsWith(label)
      : element.textContent?.trim() === label,
  );
  if (!item) throw new Error(`Missing filter ${role}: ${label}`);
  return item;
}
async function openFilter(
  harness: RouterTestingHarness,
  root: ParentNode,
  label: string,
): Promise<HTMLInputElement> {
  control<HTMLButtonElement>(root, 'app-filter-menu button').click();
  await harness.fixture.whenStable();
  filterItem('menuitem', label).click();
  await harness.fixture.whenStable();
  return control<HTMLInputElement>(document, '[role="dialog"] input[role="combobox"]');
}

const draftQuote = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  reference: 'DE-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
  clientDisplayName: 'Acme',
  status: 'draft',
  version: 1,
  title: 'Audit',
  currency: 'EUR',
  totalCents: 120_000,
  updatedAt: '2026-08-20T10:00:00.000Z',
} as QuoteSummaryValue;

const acceptedQuote = {
  ...draftQuote,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAC',
  reference: 'DE-2026-000002',
  status: 'accepted',
  title: 'Développement',
} as QuoteSummaryValue;

const order = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAD',
  reference: 'CO-2026-000001',
  quoteId: acceptedQuote.id,
  quoteReference: acceptedQuote.reference,
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAE',
  clientId: acceptedQuote.clientId,
  clientDisplayName: acceptedQuote.clientDisplayName,
  title: acceptedQuote.title,
  currency: 'EUR',
  totalCents: acceptedQuote.totalCents,
  createdAt: '2026-08-20T11:00:00.000Z',
  invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAF',
} as OrderSummaryValue;

const invoice = {
  id: order.invoiceId,
  orderId: order.id,
  orderReference: order.reference,
  clientId: order.clientId,
  clientDisplayName: order.clientDisplayName,
  status: 'paid',
  version: 1,
  invoiceNumber: 'FA-2026-000001',
  title: order.title,
  currency: 'EUR',
  totalCents: order.totalCents,
  updatedAt: '2026-08-21T10:00:00.000Z',
  pdf: null,
} as InvoiceSummaryValue;

describe('Affairs', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Affairs,
            children: [
              { path: 'all', component: TabPanelOutlet, data: { panel: 'affairs', tab: 'all' } },
              {
                path: 'active',
                component: TabPanelOutlet,
                data: { panel: 'affairs', tab: 'active' },
              },
              {
                path: 'attention',
                component: TabPanelOutlet,
                data: { panel: 'affairs', tab: 'attention' },
              },
              {
                path: 'completed',
                component: TabPanelOutlet,
                data: { panel: 'affairs', tab: 'completed' },
              },
            ],
          },
        ]),
        {
          provide: ClientsApi,
          useValue: {
            list: () =>
              Promise.resolve([{ id: draftQuote.clientId, displayName: 'Acme', archived: false }]),
          },
        },
        {
          provide: QuotesApi,
          useValue: { list: () => Promise.resolve([draftQuote, acceptedQuote]) },
        },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([order]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([invoice]) } },
      ],
    });
  });
  afterEach(() => scrolling.restore());
  it.each([
    { language: 'fr', labels: ['0 affaire', '1 affaire', '2 affaires'] },
    { language: 'en', labels: ['0 engagements', '1 engagement', '2 engagements'] },
  ])('announces zero, one and two filtered results in $language', async ({ language, labels }) => {
    const harness = await RouterTestingHarness.create('/all');
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    const i18n = TestBed.inject(I18nService);
    const initialLanguage = i18n.language();
    const count = control<HTMLElement>(root, 'footer.list-summary [role="status"]');
    try {
      i18n.setLanguage(language);
      await harness.fixture.whenStable();
      expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(count.textContent?.trim()).toBe(labels[2]);
      setSearch(root, 'Audit');
      await harness.fixture.whenStable();
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(count.textContent?.trim()).toBe(labels[1]);
      setSearch(root, 'zzzzzzzzzz');
      await harness.fixture.whenStable();
      expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
      expect(count.textContent?.trim()).toBe(labels[0]);
    } finally {
      i18n.setLanguage(initialLanguage);
      await harness.fixture.whenStable();
    }
  });
  it('groups the quote, order, and invoice into one business workflow', async () => {
    const harness = await RouterTestingHarness.create('/attention');
    const root: HTMLElement = harness.fixture.nativeElement;

    await harness.fixture.whenStable();
    expect(root.textContent).toContain('DE-2026-000001');
    expect(root.textContent).not.toContain('DE-2026-000002');

    root.querySelector<HTMLAnchorElement>('#affairs-completed-tab')?.click();
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('DE-2026-000002');
    expect(root.textContent).toMatch(/Réglée|Paid/);
    const row = root.querySelector('tbody tr');
    expect(row?.querySelector('td:nth-child(3)')?.classList.contains('actions-column')).toBe(false);
    expect(row?.querySelector('td:last-child')?.classList.contains('actions-column')).toBe(true);
  });
  it('restores search and filters from the URL and preserves them between views', async () => {
    const harness = await RouterTestingHarness.create(
      `/all?q=developpement&stage=paid&client=${draftQuote.clientId}`,
    );
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.textContent).toContain(acceptedQuote.reference);
    expect(root.textContent).not.toContain(draftQuote.reference);
    expect(searchControl(root).value).toBe('developpement');
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(3);
    const first = control<HTMLAnchorElement>(root, 'tbody tr td:first-child a');
    expect(first.getAttribute('href')).toContain(`/backoffice/affaires/${acceptedQuote.id}`);
    expect(root.querySelector('thead .amount')?.textContent).toMatch(/devis TTC|including VAT/);
    control<HTMLAnchorElement>(root, '#affairs-completed-tab').click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/completed?q=developpement');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });
  it('updates search in the URL and clears only its filter chip', async () => {
    const harness = await RouterTestingHarness.create('/all?stage=draft');
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    setSearch(root, 'Acme');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('q=Acme');
    control<HTMLButtonElement>(root, '[appFilterChip]').click();
    await harness.fixture.whenStable();
    expect(searchControl(root).value).toBe('');
    expect(TestBed.inject(Router).url).toContain('stage=draft');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });
  it('sorts numeric amounts in both directions and restores sort from the URL', async () => {
    TestBed.overrideProvider(QuotesApi, {
      useValue: {
        list: async () => [
          { ...draftQuote, totalCents: 900 },
          { ...acceptedQuote, totalCents: 1000 },
        ],
      },
    });
    const harness = await RouterTestingHarness.create('/all?q=Acme');
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    const router = TestBed.inject(Router);
    const references = () =>
      Array.from(root.querySelectorAll('tbody td.reference'), (cell) => cell.textContent?.trim());
    const amount = control<HTMLButtonElement>(root, '#affairs-column-amount button');
    amount.focus();
    amount.click();
    await harness.fixture.whenStable();
    const ascendingUrl = router.url;
    expect(router.parseUrl(ascendingUrl).queryParams['sort']).toBe('amount-asc');
    expect(references()).toEqual([draftQuote.reference, acceptedQuote.reference]);
    expect(root.querySelector('#affairs-column-amount')?.getAttribute('aria-sort')).toBe(
      'ascending',
    );
    expect(root.querySelectorAll('thead [aria-sort]')).toHaveLength(1);
    expect(root.querySelectorAll('button[appTableSort]')).toHaveLength(6);
    expect(root.querySelector('.actions-column button')).toBeNull();
    expect(document.activeElement).toBe(amount);
    amount.click();
    await harness.fixture.whenStable();
    expect(router.parseUrl(router.url).queryParams['sort']).toBe('amount-desc');
    expect(references()).toEqual([acceptedQuote.reference, draftQuote.reference]);
    await harness.navigateByUrl(ascendingUrl);
    await harness.fixture.whenStable();
    expect(references()).toEqual([draftQuote.reference, acceptedQuote.reference]);
    control<HTMLButtonElement>(root, '[appFilterChip]').click();
    await harness.fixture.whenStable();
    expect(router.parseUrl(router.url).queryParams['sort']).toBe('amount-asc');
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(0);
    expect(control<HTMLAnchorElement>(root, 'tbody td.reference a').getAttribute('href')).toContain(
      'sort=amount-asc',
    );
  });
  it.each(['', '?sort=unknown', '?sort=nextAction-asc', '?sort=amount-ascending'])(
    'uses updated-desc for an absent or invalid URL sort: %s',
    async (query) => {
      TestBed.overrideProvider(QuotesApi, {
        useValue: {
          list: async () => [
            { ...draftQuote, updatedAt: '2026-01-31T12:00:00.000Z' },
            { ...acceptedQuote, updatedAt: '2026-02-01T08:00:00.000Z' },
          ],
        },
      });
      const harness = await RouterTestingHarness.create(`/all${query}`);
      await harness.fixture.whenStable();
      const root: HTMLElement = harness.fixture.nativeElement;
      expect(root.querySelector('tbody td.reference')?.textContent).toContain(
        acceptedQuote.reference,
      );
      expect(root.querySelector('#affairs-column-updated')?.getAttribute('aria-sort')).toBe(
        'descending',
      );
      expect(
        control<HTMLAnchorElement>(root, 'tbody td.reference a').getAttribute('href'),
      ).toContain('sort=updated-desc');
      control<HTMLButtonElement>(root, '#affairs-column-updated button').click();
      await harness.fixture.whenStable();
      expect(root.querySelector('tbody td.reference')?.textContent).toContain(draftQuote.reference);
      expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['sort']).toBe(
        'updated-asc',
      );
    },
  );
  it('recomputes stage sorting when the display language changes', async () => {
    TestBed.overrideProvider(QuotesApi, {
      useValue: {
        list: async () => [draftQuote, { ...acceptedQuote, status: 'expired' }],
      },
    });
    TestBed.overrideProvider(OrdersApi, { useValue: { list: async () => [] } });
    const harness = await RouterTestingHarness.create('/all?sort=stage-asc');
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    const i18n = TestBed.inject(I18nService);
    const initialLanguage = i18n.language();
    const stageLabels = () =>
      Array.from(root.querySelectorAll('tbody td:nth-child(4)'), (cell) =>
        cell.textContent?.trim(),
      );
    try {
      i18n.setLanguage('fr');
      await harness.fixture.whenStable();
      expect(stageLabels()).toEqual(['Devis à préparer', 'Devis expiré']);
      expect(root.querySelector('tbody td.reference')?.textContent).toContain(draftQuote.reference);
      i18n.setLanguage('en');
      await harness.fixture.whenStable();
      expect(stageLabels()).toEqual(['Quote expired', 'Quote to prepare']);
      expect(root.querySelector('tbody td.reference')?.textContent).toContain(
        acceptedQuote.reference,
      );
      expect(root.querySelector('#affairs-column-stage')?.getAttribute('aria-sort')).toBe(
        'ascending',
      );
      expect(TestBed.inject(Router).url).toContain('sort=stage-asc');
    } finally {
      i18n.setLanguage(initialLanguage);
      await harness.fixture.whenStable();
    }
  });
  it('exports only displayed columns and loaded Fuse matches in the current sort order', async () => {
    TestBed.overrideProvider(QuotesApi, {
      useValue: {
        list: async () => [
          { ...draftQuote, totalCents: 900 },
          { ...acceptedQuote, totalCents: 1000 },
        ],
      },
    });
    const harness = await RouterTestingHarness.create('/all?q=acmme&sort=amount-desc');
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    const exportComponent = harness.fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exportComponent.filename()).toBe('affairs.csv');
    expect(exportComponent.columns()).toHaveLength(6);
    expect(exportComponent.rows().map((row) => row[0])).toEqual([
      acceptedQuote.reference,
      draftQuote.reference,
    ]);
    expect(exportComponent.rows().every((row) => row.length === 6)).toBe(true);
    const csv = serializeCsv(exportComponent.columns(), exportComponent.rows());
    expect(csv).not.toContain(draftQuote.id);
    expect(csv).not.toContain(draftQuote.clientId);
    const filterTrigger = control<HTMLButtonElement>(root, 'app-filter-menu button');
    filterTrigger.focus();
    const i18n = TestBed.inject(I18nService);
    const stage = await openFilter(harness, root, i18n.t('backOffice.affairs.progress'));
    expect(document.activeElement).toBe(stage);
    expect(stage.getAttribute('aria-label')).toBe(i18n.t('listWorkspace.searchChoices'));
    inputValue(
      document,
      '[role="dialog"] input[role="combobox"]',
      i18n.t('backOffice.affairs.stage.draft'),
    );
    await harness.fixture.whenStable();
    expect(exportComponent.rows()).toHaveLength(2);
    filterItem('option', i18n.t('backOffice.affairs.stage.draft')).click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(filterTrigger);
    expect(filterTrigger.getAttribute('aria-label')).toMatch(/\(1\)$/);
    expect(exportComponent.rows().map((row) => row[0])).toEqual([draftQuote.reference]);
    setSearch(root, 'zzzzzzzzzz');
    await harness.fixture.whenStable();
    expect(exportComponent.rows()).toEqual([]);
    const exportButton = control<HTMLButtonElement>(root, 'app-table-export button');
    expect(exportButton.disabled).toBe(false);
    expect(exportButton.getAttribute('aria-disabled')).toBe('true');
    control<HTMLButtonElement>(root, '.filter-summary button[appButton]').click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(searchControl(root));
    expect(exportComponent.rows().map((row) => row[0])).toEqual([
      acceptedQuote.reference,
      draftQuote.reference,
    ]);
  });
  it('commits searched filter options and preserves context when returning or closing without a choice', async () => {
    const harness = await RouterTestingHarness.create('/all?q=Acme&stage=draft&sort=amount-desc');
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    const router = TestBed.inject(Router);
    const i18n = TestBed.inject(I18nService);
    const trigger = control<HTMLButtonElement>(root, 'app-filter-menu button');
    const progress = i18n.t('backOffice.affairs.progress');
    const client = i18n.t('backOffice.affairs.client');
    const originalUrl = router.url;
    trigger.click();
    await harness.fixture.whenStable();
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    expect(document.querySelector('[role="dialog"] input')).toBeNull();
    expect(document.querySelector('[role="dialog"] select')).toBeNull();
    const category = filterItem('menuitem', progress);
    expect(document.activeElement).toBe(category);
    expect(category.textContent).toContain(i18n.t('backOffice.affairs.stage.draft'));
    pressKey(category, 'Enter', 13);
    await harness.fixture.whenStable();
    const choices = control<HTMLInputElement>(document, '[role="dialog"] input[role="combobox"]');
    expect(document.activeElement).toBe(choices);
    expect(document.querySelector('[role="dialog"] select')).toBeNull();
    expect(
      filterItem('option', i18n.t('backOffice.affairs.stage.draft')).getAttribute('aria-selected'),
    ).toBe('true');
    inputValue(document, '[role="dialog"] input[role="combobox"]', 'zzzzzzzzzz');
    await harness.fixture.whenStable();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(document.querySelector('[role="dialog"] [role="status"]')?.textContent).toBe(
      i18n.t('listWorkspace.noChoices'),
    );
    pressKey(choices, 'Escape', 27);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(router.url).toBe(originalUrl);

    await openFilter(harness, root, progress);
    filterItem('option', i18n.t('commercial.allStages')).click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(router.parseUrl(router.url).queryParams).toMatchObject({
      q: 'Acme',
      stage: '',
      sort: 'amount-desc',
      view: 'all',
    });

    const clientChoices = await openFilter(harness, root, client);
    inputValue(document, '[role="dialog"] input[role="combobox"]', 'Acmme');
    await harness.fixture.whenStable();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(router.parseUrl(router.url).queryParams['client']).toBe('');
    pressKey(clientChoices, 'Home');
    await harness.fixture.whenStable();
    pressKey(clientChoices, 'Enter');
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    const selectedUrl = router.url;
    expect(router.parseUrl(selectedUrl).queryParams).toEqual({
      q: 'Acme',
      stage: '',
      client: draftQuote.clientId,
      sort: 'amount-desc',
      view: 'all',
    });
    expect(trigger.getAttribute('aria-label')).toMatch(/\(1\)$/);
    await openFilter(harness, root, client);
    expect(filterItem('option', 'Acme').getAttribute('aria-selected')).toBe('true');
    const back = control<HTMLButtonElement>(document, '[role="dialog"] button.back');
    expect(back.getAttribute('aria-label')).toBe(i18n.t('listWorkspace.backFilters'));
    back.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(filterItem('menuitem', client));
    expect(filterItem('menuitem', client).textContent).toContain('Acme');
    control<HTMLButtonElement>(document, '[role="dialog"] button.close').click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
    expect(router.url).toBe(selectedUrl);
    await openFilter(harness, root, client);
    filterItem('option', i18n.t('commercial.allClients')).click();
    await harness.fixture.whenStable();
    expect(router.parseUrl(router.url).queryParams).toMatchObject({
      q: 'Acme',
      client: '',
      sort: 'amount-desc',
    });
    await harness.navigateByUrl(selectedUrl);
    await harness.fixture.whenStable();
    await openFilter(harness, root, client);
    expect(filterItem('option', 'Acme').getAttribute('aria-selected')).toBe('true');
    control<HTMLButtonElement>(document, '[role="dialog"] button.close').click();
    await harness.fixture.whenStable();
  });
  it('blocks exports before list loading completes', async () => {
    let finish!: (quotes: readonly QuoteSummaryValue[]) => void;
    const loading = new Promise<readonly QuoteSummaryValue[]>((resolve) => {
      finish = resolve;
    });
    TestBed.overrideProvider(QuotesApi, {
      useValue: { list: () => loading },
    });
    const harness = await RouterTestingHarness.create('/all');
    try {
      // Le chargement reste actif. Attendez le rendu, pas la stabilité de l’application.
      await vi.waitFor(() =>
        expect(harness.fixture.nativeElement.querySelector('app-table-export')).not.toBeNull(),
      );
      const pendingExport = harness.fixture.debugElement.query(By.directive(TableExport))
        .componentInstance as TableExport;
      expect(harness.fixture.isStable()).toBe(false);
      expect(pendingExport.rows()).toEqual([]);
      expect(pendingExport.pending()).toBe(true);
      expect(
        control<HTMLButtonElement>(
          harness.fixture.nativeElement,
          'app-table-export button',
        ).getAttribute('aria-disabled'),
      ).toBe('true');
    } finally {
      finish([draftQuote, acceptedQuote]);
    }
    await harness.fixture.whenStable();
    const exportComponent = harness.fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exportComponent.pending()).toBe(false);
    expect(exportComponent.rows().map((row) => row[0])).toEqual([
      draftQuote.reference,
      acceptedQuote.reference,
    ]);
    expect(
      control<HTMLButtonElement>(
        harness.fixture.nativeElement,
        'app-table-export button',
      ).getAttribute('aria-disabled'),
    ).toBe('false');
  });
});
