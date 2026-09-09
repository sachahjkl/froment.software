import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
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

async function configure(list = vi.fn().mockResolvedValue([client, archivedClient])) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: '',
          component: Clients,
          children: ['active', 'archived', 'all'].map((tab) => ({
            path: tab,
            component: TabPanelOutlet,
            data: { panel: 'clients', tab },
          })),
        },
      ]),
      { provide: ClientsApi, useValue: { list } },
    ],
  });
  const harness = await RouterTestingHarness.create('/active');
  await harness.fixture.whenStable();
  return { fixture: harness.fixture, root: harness.fixture.nativeElement as HTMLElement };
}

describe('Clients', () => {
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
    const search = root.querySelector<HTMLInputElement>('#clients-search')!;
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
