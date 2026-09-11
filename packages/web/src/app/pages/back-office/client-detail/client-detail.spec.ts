import { provideAccount } from '@backoffice/account.spec-helper';
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
import { I18nService } from '@app/i18n.service';
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

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function configure(panel = 'profile', archived = false, query = '') {
  const api = {
    get: vi.fn().mockResolvedValue({ success: true, result: { ...client, archived } }),
    listAccess: vi.fn().mockResolvedValue({ success: true, result: [access] }),
    archive: vi.fn().mockResolvedValue({ success: true, result: { ...client, archived: true } }),
    reactivate: vi.fn().mockResolvedValue({ success: true, result: client }),
    revokeAccess: vi.fn().mockResolvedValue({ success: true, result: null }),
  };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  const quotesApi = { list: vi.fn().mockResolvedValue([]) };
  const ordersApi = { list: vi.fn().mockResolvedValue([]) };
  const invoicesApi = { list: vi.fn().mockResolvedValue([]) };
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
      { provide: QuotesApi, useValue: quotesApi },
      { provide: OrdersApi, useValue: ordersApi },
      { provide: InvoicesApi, useValue: invoicesApi },
    ],
  });
  const harness = await RouterTestingHarness.create(`/${client.id}/${panel}${query}`);
  await harness.fixture.whenStable();
  return {
    api,
    confirmation,
    quotesApi,
    ordersApi,
    invoicesApi,
    fixture: harness.fixture,
    root: harness.fixture.nativeElement as HTMLElement,
    component: harness.fixture.debugElement.query(By.directive(ClientDetail))
      .componentInstance as ClientDetail,
  };
}

describe('ClientDetail', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('shows a read-only profile and a dedicated edit link', async () => {
    const { root } = await configure();
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Acme');
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('.profile')?.textContent).toContain(client.email);
    expect(root.querySelector('[pageActions] a')?.getAttribute('href')).toBe(
      `/backoffice/quotes/new?clientId=${client.id}`,
    );
    expect(root.querySelectorAll('[pageActions] a')[1]?.getAttribute('href')).toBe(
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
    expect(root.querySelector('[pageActions] a')).toBeNull();
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

  it('does not use an order number for an unnumbered invoice or its export', async () => {
    const { component, invoicesApi } = await configure('documents');
    TestBed.inject(I18nService).setLanguage('fr');
    invoicesApi.list.mockResolvedValueOnce([
      {
        id: access.id,
        clientId: client.id,
        invoiceNumber: null,
        orderReference: 'CO-2026-000001',
        title: 'Audit',
        status: 'draft',
        totalCents: 1200,
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    await component['load']();
    expect(component['documents']()[0]?.reference).toBe('Facture brouillon');
    expect(component['documentExportRows']()[0]).toContain('Facture brouillon');
    expect(component['documentExportRows']()[0]).not.toContain('CO-2026-000001');
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
    root.querySelector<HTMLButtonElement>('tbody button')!.click();
    await fixture.whenStable();
    expect(api.revokeAccess).toHaveBeenCalledWith(client.id, access.id);
    expect(root.textContent).not.toContain(access.email);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Acme');
  });

  it('keeps the client list return context separate from the table queries', async () => {
    const { component } = await configure(
      'access',
      false,
      '?q=Acme&view=archived&country=France&contact=incomplete&sort=name-desc&clientAccessQ=portal&clientDocumentType=invoice',
    );
    expect(component['backLink']()).toEqual(['/backoffice/clients', 'archived']);
    expect(component['returnQuery']()).toEqual({
      q: 'Acme',
      country: 'France',
      contact: 'incomplete',
      sort: 'name-desc',
    });
    expect(component['accessTable'].query().q).toBe('portal');
    expect(component['documentTable'].query().filter).toBe('invoice');
  });

  it('keeps access loading and errors separate from an empty result', async () => {
    const { component, api } = await configure('access');
    const pending = deferred<{ success: false; code: 'client.error' }>();
    api.listAccess.mockReturnValueOnce(pending.promise);
    const loading = component['load']();
    await Promise.resolve();
    expect(component['accessesLoading']()).toBe(true);
    expect(component['accessExportRows']()).toEqual([]);
    pending.resolve({ success: false, code: 'client.error' });
    await loading;
    expect(component['accessesLoading']()).toBe(false);
    expect(component['accessesError']()).toBe('client.error');
    expect(component['accessExportRows']()).toEqual([]);
    api.listAccess.mockResolvedValueOnce({ success: true, result: [] });
    await component['load']();
    expect(component['accessesError']()).toBeUndefined();
    expect(component['accessEmptyLabel']()).toBe('backOffice.clientDetail.accessListEmpty');
  });

  it('distinguishes no matches from an empty account list', async () => {
    const { component } = await configure('access', false, '?clientAccessQ=unmatched-zzzzzz');
    expect(component['accessTable'].rows()).toEqual([]);
    expect(component['accessEmptyLabel']()).toBe('clientTables.accessNoMatches');
    expect(component['accessExportRows']()).toEqual([]);
  });

  it('filters access exports by the creation period without changing the stored accounts', async () => {
    const { component } = await configure('access', false, '?clientAccessFrom=2026-09-01');
    expect(component['accesses']()).toHaveLength(1);
    expect(component['accessTable'].rows()).toEqual([]);
    expect(component['accessExportRows']()).toEqual([]);
    expect(component['accessEmptyLabel']()).toBe('clientTables.accessNoMatches');
  });

  it('merges only the access period keys and refuses a reversed period', async () => {
    const { component } = await configure('access');
    const navigate = vi.spyOn(component['router'], 'navigate').mockResolvedValue(true);
    component['applyAccessPeriod']({ from: '2026-10-01', to: '2026-09-01' });
    expect(navigate).not.toHaveBeenCalled();
    component['applyAccessPeriod']({ from: '2026-09-01', to: '2026-09-30' });
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { clientAccessFrom: '2026-09-01', clientAccessTo: '2026-09-30' },
        queryParamsHandling: 'merge',
      }),
    );
    component['applyAccessPeriod']({});
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { clientAccessFrom: null, clientAccessTo: null },
        queryParamsHandling: 'merge',
      }),
    );
    navigate.mockRestore();
  });

  it('does not revoke access when confirmation is refused', async () => {
    const { component, api } = await configure('access');
    await component['revokeAccess'](access);
    expect(api.revokeAccess).not.toHaveBeenCalled();
    expect(component['accessTable'].rows()).toHaveLength(1);
  });

  it('does not hide loaded affairs when another document source fails', async () => {
    const { component, quotesApi, ordersApi } = await configure();
    quotesApi.list.mockResolvedValueOnce([
      {
        id: access.id,
        clientId: client.id,
        clientDisplayName: client.displayName,
        reference: 'DEV-2026-0001',
        title: 'Projet',
        status: 'draft',
        version: 1,
        currency: 'EUR',
        totalCents: 100,
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);
    ordersApi.list.mockRejectedValueOnce(new Error('failed'));
    await component['load']();
    expect(component['affairsError']()).toBe(false);
    expect(component['affairTable'].rows()).toHaveLength(1);
    expect(component['affairExportRows']()).toHaveLength(1);
    expect(component['documentsError']()).toBe(true);
    expect(component['documentExportRows']()).toEqual([]);
  });

  it('blocks exit and exports during revocation and keeps the record on failure', async () => {
    const { component, api, confirmation } = await configure('access');
    confirmation.request.mockResolvedValue(true);
    const pending = deferred<{ success: false; code: 'client.error' }>();
    api.revokeAccess.mockReturnValueOnce(pending.promise);
    const revoking = component['revokeAccess'](access);
    await Promise.resolve();
    expect(await component.canDeactivate()).toBe(false);
    expect(component['accessExportRows']()).toEqual([]);
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    component['preventUnsavedUnload'](event);
    expect(event.defaultPrevented).toBe(true);
    pending.resolve({ success: false, code: 'client.error' });
    await revoking;
    expect(await component.canDeactivate()).toBe(true);
    expect(component['accessTable'].rows()).toHaveLength(1);
    expect(component['error']()).toBe('client.error');
    expect(component['accessExportRows']()).toHaveLength(1);
  });

  it.each(['archive', 'reactivate'] as const)('blocks exit while %s is pending', async (action) => {
    const { component, api, confirmation } = await configure('profile', action === 'reactivate');
    confirmation.request.mockResolvedValue(true);
    const pending = deferred<{ success: true; result: typeof client }>();
    api[action].mockReturnValueOnce(pending.promise);
    const operation = component[action]();
    await Promise.resolve();
    expect(await component.canDeactivate()).toBe(false);
    pending.resolve({ success: true, result: client });
    await operation;
    expect(await component.canDeactivate()).toBe(true);
  });
});
