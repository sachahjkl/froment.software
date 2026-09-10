import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { CatalogApi } from '@backoffice/catalog-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { TableExport } from '@shared/table-export/table-export';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';
import { Catalog } from './catalog';
import { CatalogEditor } from '../catalog-editor/catalog-editor';

const item = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  description: 'Développement Angular',
  quantityMilli: 1000,
  unitPriceCents: 12500,
  vatRateBasisPoints: 2000,
  currency: 'EUR',
  version: 3,
  archived: false,
};
const records = [
  item,
  {
    ...item,
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    description: 'Audit comptable',
    quantityMilli: 10000,
    unitPriceCents: 7500,
    vatRateBasisPoints: 550,
  },
  { ...item, id: '01ARZ3NDEKTSV4RRFFQ69G5FAX', description: 'Ancienne prestation', archived: true },
];

function searchInput(root: HTMLElement): HTMLInputElement {
  const label = Array.from(root.querySelectorAll('label')).find((label) =>
    label.textContent?.includes(TestBed.inject(I18nService).t('catalog.search')),
  );
  return label!.querySelector<HTMLInputElement>('input[type="search"]')!;
}

function sortButton(root: HTMLElement, label: TranslationKey): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('[appTableSort]')).find((button) =>
    button.textContent?.includes(TestBed.inject(I18nService).t(label)),
  )!;
}

async function openTaxChoices(root: HTMLElement, harness: RouterTestingHarness) {
  const i18n = TestBed.inject(I18nService);
  const trigger = root.querySelector<HTMLButtonElement>('app-filter-menu button')!;
  trigger.click();
  await harness.fixture.whenStable();
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const heading = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
  expect(heading.textContent).toBe(i18n.t('listWorkspace.filters'));
  expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(1);
  expect(dialog.querySelector('[role="combobox"], select')).toBeNull();
  const category = dialog.querySelector<HTMLElement>('[role="menuitem"]')!;
  expect(category.textContent).toContain(i18n.t('catalog.tax'));
  expect(document.activeElement).toBe(category);
  pressKey(category, 'Enter', 13);
  await harness.fixture.whenStable();
  expect(heading.textContent).toBe(i18n.t('catalog.tax'));
  expect(dialog.querySelector('[role="menu"]')).toBeNull();
  const input = dialog.querySelector<HTMLInputElement>('app-filter-choice [role="combobox"]')!;
  expect(input.getAttribute('aria-label')).toBe(i18n.t('listWorkspace.searchChoices'));
  expect(input.getAttribute('aria-expanded')).toBe('true');
  expect(document.activeElement).toBe(input);
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  return { trigger, dialog, input };
}

async function configure(url = '/backoffice/catalogue/active', fail = false) {
  const list = vi.fn().mockImplementation(async () => {
    if (fail) throw new Error('unavailable');
    return records;
  });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'backoffice/catalogue/new', component: CatalogEditor },
        { path: 'backoffice/catalogue/:itemId/edit', component: CatalogEditor },
        {
          path: 'backoffice/catalogue',
          component: Catalog,
          children: ['active', 'archived', 'all'].map((tab) => ({
            path: tab,
            component: TabPanelOutlet,
            data: { panel: 'catalog', tab },
          })),
        },
      ]),
      { provide: CatalogApi, useValue: { list } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, Catalog);
  await harness.fixture.whenStable();
  return {
    harness,
    component,
    root: harness.fixture.nativeElement as HTMLElement,
    list,
    router: TestBed.inject(Router),
  };
}

describe('Catalog', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;

  beforeEach(() => {
    scrolling = installScrollIntoView();
  });

  afterEach(() => scrolling.restore());

  it('shows a focused list with dedicated editor links and URL-backed fuzzy search', async () => {
    const { root, harness, router, component } = await configure();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    const search = searchInput(root);
    search.value = 'developement';
    search.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(router.url).toBe('/backoffice/catalogue/active?q=developement&sort=description-asc');
    expect(component['visibleItems']('active')[0]?.matches.length).toBeGreaterThan(0);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toContain(`/${item.id}/edit?`);
    expect(
      root.querySelector('#catalog-active-tab')?.getAttribute('aria-current'),
      root.querySelector('#catalog-active-tab')?.outerHTML,
    ).toBe('page');
    root.querySelector<HTMLButtonElement>('[appFilterChip]')!.click();
    await harness.fixture.whenStable();
    expect(search.value).toBe('');
    expect(document.activeElement).toBe(search);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('preserves search, VAT and sort through views, an editor, and the return link', async () => {
    const { root, harness, router } = await configure(
      '/backoffice/catalogue/all?q=angular&sort=quantity-desc&tax=2000',
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    root.querySelector<HTMLAnchorElement>('tbody a')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toContain('view=all');
    expect(router.url).toContain('tax=2000');
    expect(root.querySelector<HTMLInputElement>('#catalog-description')?.value).toBe(
      item.description,
    );
    root.querySelector<HTMLAnchorElement>('.back-link')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/backoffice/catalogue/all?q=angular&sort=quantity-desc&tax=2000');
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(2);
    root.querySelector<HTMLAnchorElement>('#catalog-archived-tab')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/backoffice/catalogue/archived?q=angular&sort=quantity-desc&tax=2000');
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    expect(root.querySelector('app-page-header a')?.getAttribute('href')).toContain(
      'view=archived',
    );
  });

  it('sorts prices without changing stored records', async () => {
    const { root, harness } = await configure();
    const sort = sortButton(root, 'catalogWorkspace.price');
    sort.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('tbody a')?.textContent).toBe('Audit comptable');
    expect(sort.parentElement?.getAttribute('aria-sort')).toBe('ascending');
    sort.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('tbody a')?.textContent).toBe(item.description);
    expect(sort.parentElement?.getAttribute('aria-sort')).toBe('descending');
    expect(records[0]).toBe(item);
  });

  it.each([
    {
      column: 'description',
      label: 'catalog.description',
      ascending: [2, 1, 0],
      descending: [0, 1, 2],
    },
    { column: 'quantity', label: 'catalog.quantity', ascending: [0, 2, 1], descending: [1, 0, 2] },
    {
      column: 'price',
      label: 'catalogWorkspace.price',
      ascending: [1, 0, 2],
      descending: [0, 2, 1],
    },
    { column: 'tax', label: 'catalog.tax', ascending: [1, 0, 2], descending: [0, 2, 1] },
    {
      column: 'status',
      label: 'catalogWorkspace.status',
      ascending: [0, 1, 2],
      descending: [2, 0, 1],
    },
  ] as const)(
    'sorts $column using raw values and stable IDs',
    async ({ column, label, ascending, descending }) => {
      const { root, harness, router } = await configure(
        `/backoffice/catalogue/all?sort=${column}-desc`,
      );
      const descriptions = () =>
        Array.from(root.querySelectorAll('tbody a'), (link) => link.textContent);
      const expected = (indexes: readonly number[]) =>
        indexes.map((index) => records[index]!.description);
      expect(root.querySelectorAll('[appTableSort]')).toHaveLength(5);
      expect(descriptions()).toEqual(expected(descending));
      const sort = sortButton(root, label);
      sort.click();
      await harness.fixture.whenStable();
      expect(descriptions()).toEqual(expected(ascending));
      expect(sort.parentElement?.getAttribute('aria-sort')).toBe('ascending');
      expect(root.querySelectorAll('th[aria-sort]')).toHaveLength(1);
      expect(router.url).toContain(`sort=${column}-asc`);
      sort.click();
      await harness.fixture.whenStable();
      expect(descriptions()).toEqual(expected(descending));
      expect(sort.parentElement?.getAttribute('aria-sort')).toBe('descending');
      expect(records[0]).toBe(item);
    },
  );

  it('searches VAT choices and commits with the keyboard before restoring focus', async () => {
    const { root, harness, router } = await configure('/backoffice/catalogue/all?sort=price-desc');
    const { trigger, dialog, input } = await openTaxChoices(root, harness);
    expect(
      Array.from(dialog.querySelectorAll('[role="option"]'), (option) =>
        option.textContent?.trim(),
      ),
    ).toEqual([
      TestBed.inject(I18nService).t('catalogWorkspace.allTaxRates'),
      expect.stringMatching(/^5[,.]50 %$/),
      expect.stringMatching(/^20[,.]00 %$/),
    ]);
    const initialUrl = router.url;
    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(dialog.querySelector('[role="option"]')?.textContent?.trim()).toMatch(/^5[,.]50 %$/);
    expect(dialog.querySelector('[role="option"][aria-selected="true"]')).toBeNull();
    expect(router.url).toBe(initialUrl);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    pressKey(input, 'Home', 36);
    await harness.fixture.whenStable();
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent?.trim(),
    ).toMatch(/^5[,.]50 %$/);
    expect(router.url).toBe(initialUrl);
    pressKey(input, 'Enter', 13);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody a')?.textContent).toBe('Audit comptable');
    expect(router.url).toContain('tax=550');
    expect(trigger.getAttribute('aria-label')).toContain('(1)');
    const selected = await openTaxChoices(root, harness);
    expect(selected.input.value).toBe('');
    expect(selected.dialog.querySelectorAll('[role="option"][aria-selected="true"]')).toHaveLength(
      1,
    );
    expect(
      selected.dialog.querySelector('[role="option"][aria-selected="true"]')?.textContent?.trim(),
    ).toMatch(/^5[,.]50 %$/);
    selected.input.value = '20';
    selected.input.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(selected.dialog.querySelectorAll('[role="option"]')).toHaveLength(1);
    pressKey(selected.input, 'Home', 36);
    await harness.fixture.whenStable();
    expect(router.url).toContain('tax=550');
    pressKey(selected.input, 'Escape', 27);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(router.url).toContain('tax=550');
    expect(root.querySelector('tbody a')?.textContent).toBe('Audit comptable');
    root.querySelector<HTMLButtonElement>('[appFilterChip]')!.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(searchInput(root));
    expect(router.url).not.toContain('tax=');
    expect(router.url).toContain('sort=price-desc');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('keeps a valid VAT rate without results and clears both filters without clearing sort', async () => {
    const { root, harness, router } = await configure(
      '/backoffice/catalogue/all?q=angular&sort=tax-desc&tax=0',
    );
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(2);
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    const { trigger, dialog, input } = await openTaxChoices(root, harness);
    expect(dialog.querySelectorAll('[role="option"][aria-selected="true"]')).toHaveLength(1);
    expect(
      dialog.querySelector('[role="option"][aria-selected="true"]')?.textContent?.trim(),
    ).toMatch(/^0[,.]00 %$/);
    pressKey(input, 'Escape', 27);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(router.url).toBe('/backoffice/catalogue/all?q=angular&sort=tax-desc&tax=0');
    root.querySelector<HTMLButtonElement>('app-empty-state button')!.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(searchInput(root));
    expect(router.url).toBe('/backoffice/catalogue/all?q=&sort=tax-desc');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(0);
  });

  it('exports only displayed records in table order with explicit public columns', async () => {
    const { harness, component, root } = await configure(
      '/backoffice/catalogue/all?sort=price-desc&tax=2000',
    );
    const exporter = harness.fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    const i18n = TestBed.inject(I18nService);
    expect(exporter.columns()).toEqual([
      i18n.t('catalog.description'),
      i18n.t('catalog.quantity'),
      i18n.t('catalogWorkspace.exportPrice'),
      i18n.t('catalog.tax'),
      i18n.t('catalogWorkspace.status'),
    ]);
    expect(exporter.rows()).toEqual([
      [item.description, '1.000', '125.00', '20.00', i18n.t('catalogWorkspace.available')],
      ['Ancienne prestation', '1.000', '125.00', '20.00', i18n.t('catalog.archived')],
    ]);
    expect(exporter.filename()).toBe('catalog.csv');
    expect(exporter.pending()).toBe(false);
    const search = searchInput(root);
    search.value = 'angular';
    search.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(exporter.rows()).toEqual([
      [item.description, '1.000', '125.00', '20.00', i18n.t('catalogWorkspace.available')],
    ]);
    expect(component['exportRows']('archived')).toEqual([]);
    expect(root.querySelector('app-table-export button')?.getAttribute('aria-disabled')).toBe(
      'false',
    );
    expect(exporter.emptyHint()).toBe(i18n.t('listWorkspace.exportEmpty'));
    expect(exporter.pendingHint()).toBe(i18n.t('listWorkspace.exportPending'));
  });

  it('preserves decimal precision at the integer limits in exports', async () => {
    const { component, list, harness } = await configure();
    list.mockResolvedValue([
      { ...item, quantityMilli: Number.MAX_SAFE_INTEGER, unitPriceCents: Number.MAX_SAFE_INTEGER },
    ]);
    await component['load']();
    await harness.fixture.whenStable();
    const exporter = harness.fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exporter.rows()[0]?.slice(1, 4)).toEqual([
      '9007199254740.991',
      '90071992547409.91',
      '20.00',
    ]);
  });

  it('separates load errors from empty results and retries', async () => {
    const { root, list, harness } = await configure('/backoffice/catalogue/active', true);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('app-empty-state')).toBeNull();
    const exporter = harness.fixture.debugElement.query(By.directive(TableExport))
      .componentInstance as TableExport;
    expect(exporter.pending()).toBe(true);
    expect(exporter.rows()).toEqual([]);
    expect(root.querySelector<HTMLButtonElement>('app-filter-menu button')?.disabled).toBe(true);
    expect(root.querySelector('app-table-export button')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
    list.mockResolvedValue([]);
    root.querySelector<HTMLButtonElement>('.notice-flow button')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    expect(exporter.pending()).toBe(false);
    expect(exporter.rows()).toEqual([]);
    expect(root.querySelector('app-table-export button')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});
