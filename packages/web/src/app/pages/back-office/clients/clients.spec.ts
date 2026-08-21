import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ClientsApi } from '@backoffice/clients-api';
import { type ClientCreateRequestValue, type ClientListValue } from '@froment/contracts';
import { Clients } from './clients';

class ClientsApiStub {
  readonly createdNames: Array<string> = [];
  constructor(private readonly initialClients: ClientListValue = []) {}

  list(): Promise<ClientListValue> {
    return Promise.resolve(this.initialClients);
  }

  create(request: ClientCreateRequestValue) {
    this.createdNames.push(request.displayName);
    return Promise.resolve({
      success: true as const,
      result: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' as const,
        ...request,
        archived: false,
        updatedAt: 1,
      },
    });
  }
}

const openCreateModal = async (fixture: ComponentFixture<Clients>) => {
  const root: HTMLElement = fixture.nativeElement;
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  if (dialog) {
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
  }
  root.querySelector<HTMLButtonElement>('.clients-page > header button')?.click();
  await fixture.whenStable();
  return root;
};

describe('Clients', () => {
  it('does not replace a created client with an older list response', async () => {
    let resolveList!: (clients: ClientListValue) => void;
    const api = new ClientsApiStub();
    vi.spyOn(api, 'list').mockReturnValue(new Promise((resolve) => (resolveList = resolve)));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();
    const root = await openCreateModal(fixture);
    const input = root.querySelector<HTMLInputElement>('input')!;

    input.value = 'Created while loading';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
    await fixture.whenStable();
    expect(api.createdNames).toEqual(['Created while loading']);
    resolveList([]);
    await vi.waitFor(() => expect(root.textContent).not.toMatch(/Loading clients|Chargement/));

    expect(root.textContent).toContain('Created while loading');
  });

  it('creates and displays a client', async () => {
    const api = new ClientsApiStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();
    const root = await openCreateModal(fixture);
    const input = root.querySelector<HTMLInputElement>('input');
    if (input === null) throw new Error('The client name input is unavailable.');

    input.value = 'Acme';
    input.dispatchEvent(new Event('input'));
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.createdNames).toEqual(['Acme']);
    expect(root.textContent).toContain('Acme');
    expect(root.querySelector('dialog')?.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('.clients-page > header button'));
  });

  it('shows validation feedback without sending an invalid client', async () => {
    const api = new ClientsApiStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();
    const root = await openCreateModal(fixture);
    const form = root.querySelector<HTMLFormElement>('form');
    if (form === null) throw new Error('The client form is unavailable.');

    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.createdNames).toEqual([]);
    expect(root.querySelector<HTMLInputElement>('input')?.getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(root.querySelector('#client-display-name-error')?.textContent).toContain('120');
  });

  it('keeps an archived client action cell in the table layout', async () => {
    const api = new ClientsApiStub([
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        displayName: 'Acme',
        addressLine1: '',
        addressLine2: '',
        postalCode: '',
        city: '',
        country: '',
        email: '',
        archived: true,
        updatedAt: 1,
      },
    ]);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('#clients-archived-tab')?.click();
    await fixture.whenStable();
    const actionCell = root.querySelector<HTMLTableCellElement>('tbody td:last-child');

    expect(actionCell?.classList.contains('actions')).toBe(false);
    expect(actionCell?.querySelector('.actions')).not.toBeNull();
  });

  it('links each client to its detail page', async () => {
    const api = new ClientsApiStub([
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        displayName: 'Acme',
        addressLine1: '',
        addressLine2: '',
        postalCode: '',
        city: '',
        country: '',
        email: '',
        archived: false,
        updatedAt: 1,
      },
    ]);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector<HTMLAnchorElement>('tbody a')?.getAttribute('href')).toBe(
      '/backoffice/clients/01ARZ3NDEKTSV4RRFFQ69G5FAV',
    );
  });
});
