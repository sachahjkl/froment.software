import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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

describe('Clients', () => {
  it('creates and displays a client', async () => {
    const api = new ClientsApiStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input');
    if (input === null) throw new Error('The client name input is unavailable.');

    input.value = 'Acme';
    input.dispatchEvent(new Event('input'));
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.createdNames).toEqual(['Acme']);
    expect(root.textContent).toContain('Acme');
  });

  it('shows validation feedback without sending an invalid client', async () => {
    const api = new ClientsApiStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(Clients);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
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
