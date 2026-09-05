import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CatalogApi } from '@backoffice/catalog-api';
import { Catalog } from './catalog';

const item = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  description: 'Audit',
  quantityMilli: 1000,
  unitPriceCents: 12500,
  vatRateBasisPoints: 2000,
  currency: 'EUR',
  version: 3,
  archived: false,
};

describe('Catalog', () => {
  it('updates with the loaded version and archives without deleting', async () => {
    const update = vi.fn(async () => ({
      success: true,
      result: { ...item, version: 4, archived: true },
    }));
    TestBed.configureTestingModule({
      providers: [{ provide: CatalogApi, useValue: { list: async () => [item], update } }],
    });
    const fixture = TestBed.createComponent(Catalog);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.items button')?.click();
    await fixture.whenStable();
    const archived = root.querySelector<HTMLInputElement>('form input[type="checkbox"]');
    expect(archived).not.toBeNull();
    archived?.click();
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(update).toHaveBeenCalledWith(item.id, {
      description: 'Audit',
      quantityMilli: 1000,
      unitPriceCents: 12500,
      vatRateBasisPoints: 2000,
      currency: 'EUR',
      expectedVersion: 3,
      archived: true,
    });
    expect(root.querySelectorAll('.items button')).toHaveLength(0);
    root.querySelector<HTMLInputElement>('.filters input[type="checkbox"]')?.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.items button')).toHaveLength(1);
  });

  it('keeps edited values when saving fails', async () => {
    const update = vi.fn(async () => ({ success: false, code: 'catalog.version_conflict' }));
    TestBed.configureTestingModule({
      providers: [{ provide: CatalogApi, useValue: { list: async () => [item], update } }],
    });
    const fixture = TestBed.createComponent(Catalog);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.items button')?.click();
    await fixture.whenStable();
    const price = root.querySelector<HTMLInputElement>('#catalog-price');
    if (price === null) throw new Error('catalog.price.input.missing');
    price.value = '150.00';
    price.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(price.value).toBe('150.00');
    expect(update).toHaveBeenCalledOnce();
  });
});
