import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ClientDetail } from './client-detail';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';

const client = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' as const,
  displayName: 'Acme',
  addressLine1: '1 rue Principale',
  addressLine2: '',
  postalCode: '69001',
  city: 'Lyon',
  country: 'France',
  email: 'contact@acme.example',
  archived: false,
  updatedAt: 42,
};
const access = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  clientId: client.id,
  email: 'portal@acme.example',
  createdAt: 1_700_000_000_000,
};

async function configure(panel = 'profile', archived = false) {
  const api = {
    get: vi.fn().mockResolvedValue({ success: true, result: { ...client, archived } }),
    listAccess: vi.fn().mockResolvedValue({ success: true, result: [access] }),
    archive: vi.fn().mockResolvedValue({ success: true, result: { ...client, archived: true } }),
    reactivate: vi.fn().mockResolvedValue({ success: true, result: client }),
    revokeAccess: vi.fn().mockResolvedValue({ success: true, result: null }),
  };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: ':clientId',
          component: ClientDetail,
          children: ['profile', 'affairs', 'access', 'documents'].map((path) => ({
            path,
            component: TabPanelOutlet,
            data: { panel: path },
          })),
        },
      ]),
      { provide: ClientsApi, useValue: api },
      { provide: Confirmation, useValue: confirmation },
      { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
    ],
  });
  const harness = await RouterTestingHarness.create(`/${client.id}/${panel}`);
  await harness.fixture.whenStable();
  return {
    api,
    confirmation,
    fixture: harness.fixture,
    root: harness.fixture.nativeElement as HTMLElement,
    component: harness.fixture.debugElement.query(By.directive(ClientDetail))
      .componentInstance as ClientDetail,
  };
}

describe('ClientDetail', () => {
  it('shows a read-only profile and a dedicated edit link', async () => {
    const { root } = await configure();
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Acme');
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('.profile')?.textContent).toContain(client.email);
    expect(root.querySelector('app-page-header a')?.getAttribute('href')).toBe(
      `/backoffice/quotes/new?clientId=${client.id}`,
    );
    expect(root.querySelectorAll('app-page-header a')[1]?.getAttribute('href')).toBe(
      `/backoffice/clients/${client.id}/edit`,
    );
  });

  it('requires confirmation before archiving and keeps the client record visible', async () => {
    const { root, api, confirmation, fixture } = await configure();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const archive = async () => {
      root.querySelector<HTMLButtonElement>('app-action-menu button')!.click();
      await fixture.whenStable();
      overlay.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();
      await fixture.whenStable();
    };
    await archive();
    expect(api.archive).not.toHaveBeenCalled();
    confirmation.request.mockResolvedValue(true);
    await archive();
    expect(api.archive).toHaveBeenCalledWith(client.id);
    expect(root.querySelector('.profile')?.textContent).toContain('Acme');
    expect(root.querySelector('app-page-header a')).toBeNull();
    expect(root.querySelector('.archived-notice')).not.toBeNull();
  });

  it('reactivates an archived client and opens the access page', async () => {
    const { root, api, fixture } = await configure('profile', true);
    root.querySelector<HTMLButtonElement>('.archived-notice button')!.click();
    await fixture.whenStable();
    expect(api.reactivate).toHaveBeenCalledWith(client.id);
    expect(root.querySelector('#client-access-panel')).not.toBeNull();
  });

  it('shows an empty document state separately from the client profile', async () => {
    const { root } = await configure('documents');
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    expect(root.querySelector('.profile')).toBeNull();
  });

  it('links to a dedicated access task instead of showing a permanent form', async () => {
    const { root } = await configure('access');
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('#client-access-panel a')?.getAttribute('href')).toBe(
      `/backoffice/clients/${client.id}/access/new`,
    );
  });

  it('lists and revokes one access account without changing the client', async () => {
    const { root, api, confirmation, fixture } = await configure('access');
    expect(root.textContent).toContain(access.email);
    confirmation.request.mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('table button')!.click();
    await fixture.whenStable();
    expect(api.revokeAccess).toHaveBeenCalledWith(client.id, access.id);
    expect(root.textContent).not.toContain(access.email);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Acme');
  });
});
