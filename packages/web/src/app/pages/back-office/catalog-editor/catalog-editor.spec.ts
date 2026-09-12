import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { CatalogApi } from '@backoffice/catalog-api';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { Confirmation } from '@shared/confirmation/confirmation';
import { CatalogEditor } from './catalog-editor';

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
@Component({ template: '<h1>Catalog</h1>' })
class Destination {}

async function configure(editing = false) {
  const api = {
    list: vi.fn().mockResolvedValue([item]),
    create: vi.fn().mockResolvedValue({ success: true, result: item }),
    update: vi.fn().mockResolvedValue({ success: true, result: { ...item, version: 4 } }),
  };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'backoffice/catalog/new',
          component: CatalogEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/catalog/:itemId/edit',
          component: CatalogEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        { path: 'backoffice/catalog/:view', component: Destination },
      ]),
      { provide: CatalogApi, useValue: api },
      { provide: Confirmation, useValue: confirmation },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(
    editing
      ? `/backoffice/catalog/${item.id}/edit?q=audit&sort=price-desc&view=all`
      : '/backoffice/catalog/new',
    CatalogEditor,
  );
  await harness.fixture.whenStable();
  const root = harness.fixture.nativeElement as HTMLElement;
  const fill = async (id: string, value: string) => {
    const input = root.querySelector<HTMLInputElement>(`#catalog-${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  };
  const save = async () => {
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit'));
    await harness.fixture.whenStable();
  };
  return {
    api,
    confirmation,
    harness,
    component,
    root,
    fill,
    save,
    router: TestBed.inject(Router),
  };
}

describe('CatalogEditor', () => {
  it('creates a service with exact decimal values', async () => {
    const { api, fill, save, router } = await configure();
    await fill('description', ' Audit ');
    await fill('quantity', '1,125');
    await fill('price', '125,01');
    await fill('tax', '5,50');
    await save();
    expect(api.create).toHaveBeenCalledExactlyOnceWith({
      description: 'Audit',
      quantityMilli: 1125,
      unitPriceCents: 12501,
      vatRateBasisPoints: 550,
      currency: 'EUR',
    });
    expect(router.url).toContain('/backoffice/catalog/active');
  });

  it('validates fields and focuses the first error without disabling submission', async () => {
    const { api, root, fill, save } = await configure();
    expect(root.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(false);
    await save();
    expect(document.activeElement?.id).toBe('catalog-description');
    await fill('description', 'Audit');
    await fill('quantity', '0');
    await fill('price', '2.001');
    await fill('tax', '100.01');
    await save();
    expect(document.activeElement?.id).toBe('catalog-quantity');
    expect(root.querySelectorAll('[aria-invalid="true"]')).toHaveLength(3);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('preserves edits and expected version after a conflict', async () => {
    const { api, fill, save, root, component } = await configure(true);
    api.update.mockResolvedValue({ success: false, code: 'catalog.version_conflict' });
    await fill('price', '150.01');
    await save();
    expect(api.update).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ expectedVersion: 3, unitPriceCents: 15001 }),
    );
    expect(root.querySelector<HTMLInputElement>('#catalog-price')?.value).toBe('150.01');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(await component.canDeactivate()).toBe(false);
  });

  it('confirms archive changes, preserves history, and returns to the original view', async () => {
    const { api, root, save, confirmation, router, harness } = await configure(true);
    root.querySelector<HTMLInputElement>('[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    await save();
    expect(api.update).not.toHaveBeenCalled();
    confirmation.request.mockResolvedValue(true);
    await save();
    expect(api.update).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ archived: true, expectedVersion: 3 }),
    );
    expect(router.url).toBe('/backoffice/catalog/all?q=audit&sort=price-desc');
  });

  it('blocks duplicate requests, route exits and native unload during saving', async () => {
    const { api, fill, save, component, root, router } = await configure();
    api.create.mockReturnValue(new Promise(() => {}));
    await fill('description', 'Pending');
    await save();
    await save();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLInputElement>('#catalog-description')?.disabled).toBe(true);
    expect(await component.canDeactivate()).toBe(false);
    expect(await router.navigateByUrl('/backoffice/catalog/active')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('guards dirty fields until the exit confirmation is accepted', async () => {
    const { fill, confirmation, router } = await configure(true);
    await fill('description', 'Unsaved');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(await router.navigateByUrl('/backoffice/catalog/all')).toBe(false);
    confirmation.request.mockResolvedValue(true);
    expect(await router.navigateByUrl('/backoffice/catalog/all')).toBe(true);
  });

  it('does not turn missing records or failed loads into creation forms', async () => {
    const { api, harness, root } = await configure();
    api.list.mockRejectedValue(new Error('unavailable'));
    await harness.navigateByUrl(`/backoffice/catalog/${item.id}/edit`, CatalogEditor);
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    api.list.mockResolvedValue([]);
    root.querySelector<HTMLButtonElement>('button')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('ignores stale loads after the route changes', async () => {
    const { api, harness, root } = await configure();
    let finish!: (value: (typeof item)[]) => void;
    api.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await harness.navigateByUrl(`/backoffice/catalog/${item.id}/edit`, CatalogEditor);
    const next = { ...item, id: '01ARZ3NDEKTSV4RRFFQ69G5FAW', description: 'Next service' };
    api.list.mockResolvedValue([next]);
    await harness.navigateByUrl(`/backoffice/catalog/${next.id}/edit`, CatalogEditor);
    await harness.fixture.whenStable();
    finish([item]);
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#catalog-description')?.value).toBe(
      'Next service',
    );
  });

  it('keeps an unexpected save error visible and re-enables the draft', async () => {
    const { api, fill, save, root } = await configure(true);
    api.update.mockRejectedValue(new Error('unavailable'));
    await fill('description', 'Changed');
    await save();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('#catalog-description')?.value).toBe('Changed');
    expect(root.querySelector<HTMLInputElement>('#catalog-description')?.disabled).toBe(false);
  });

  it('rejects malformed IDs without making a list request', async () => {
    const { api, harness, root } = await configure();
    await harness.navigateByUrl('/backoffice/catalog/invalid/edit', CatalogEditor);
    await harness.fixture.whenStable();
    expect(api.list).not.toHaveBeenCalled();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('rejects decimal overflow and accepts the exact integer bounds', async () => {
    const { api, fill, save } = await configure();
    await fill('description', 'Boundary values');
    await fill('quantity', '9007199254740.992');
    await fill('price', '90071992547409.92');
    await save();
    expect(api.create).not.toHaveBeenCalled();
    await fill('quantity', '9007199254740.991');
    await fill('price', '90071992547409.91');
    await fill('tax', '100.00');
    await save();
    expect(api.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        quantityMilli: Number.MAX_SAFE_INTEGER,
        unitPriceCents: Number.MAX_SAFE_INTEGER,
        vatRateBasisPoints: 10000,
      }),
    );
  });

  it('locks a completed save if the destination refuses navigation', async () => {
    const { api, fill, save, root, router, component, harness } = await configure(true);
    router.resetConfig(
      router.config.map((route) =>
        route.component === Destination ? { ...route, canActivate: [() => false] } : route,
      ),
    );
    await fill('description', 'Saved service');
    await save();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    component['save'](new SubmitEvent('submit'));
    await harness.fixture.whenStable();
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(await component.canDeactivate()).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('blocks duplicate archive requests and navigation while confirmation is open', async () => {
    const { api, root, save, confirmation, router, harness } = await configure(true);
    let decide!: (accepted: boolean) => void;
    confirmation.request.mockReturnValue(
      new Promise((resolve) => {
        decide = resolve;
      }),
    );
    root.querySelector<HTMLInputElement>('[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    await save();
    await save();
    expect(confirmation.request).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
    expect(await router.navigateByUrl('/backoffice/catalog/all')).toBe(false);
    decide(false);
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('[type="checkbox"]')?.checked).toBe(true);
    expect(api.update).not.toHaveBeenCalled();
  });
});
