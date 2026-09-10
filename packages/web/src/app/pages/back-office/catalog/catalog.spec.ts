import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { CatalogApi } from '@backoffice/catalog-api';
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
    unitPriceCents: 7500,
  },
  { ...item, id: '01ARZ3NDEKTSV4RRFFQ69G5FAX', description: 'Ancienne prestation', archived: true },
];

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
  it('shows a focused list with dedicated editor links and URL-backed fuzzy search', async () => {
    const { root, harness, router, component } = await configure();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    const search = root.querySelector<HTMLInputElement>('#catalog-search')!;
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

  it('preserves search and sort through views, an editor, and the return link', async () => {
    const { root, harness, router } = await configure(
      '/backoffice/catalogue/all?q=angular&sort=price-desc',
    );
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    root.querySelector<HTMLAnchorElement>('tbody a')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toContain('view=all');
    expect(root.querySelector<HTMLInputElement>('#catalog-description')?.value).toBe(
      item.description,
    );
    root.querySelector<HTMLAnchorElement>('.back-link')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/backoffice/catalogue/all?q=angular&sort=price-desc');
    root.querySelector<HTMLAnchorElement>('#catalog-archived-tab')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/backoffice/catalogue/archived?q=angular&sort=price-desc');
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    expect(root.querySelector('app-page-header a')?.getAttribute('href')).toContain(
      'view=archived',
    );
  });

  it('sorts prices without changing stored records', async () => {
    const { root, harness } = await configure();
    const sort = root.querySelector<HTMLButtonElement>('th.numeric [appTableSort]')!;
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

  it('separates load errors from empty results and retries', async () => {
    const { root, list, harness } = await configure('/backoffice/catalogue/active', true);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('app-empty-state')).toBeNull();
    list.mockResolvedValue([]);
    root.querySelector<HTMLButtonElement>('.notice-flow button')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('app-empty-state')).not.toBeNull();
  });
});
