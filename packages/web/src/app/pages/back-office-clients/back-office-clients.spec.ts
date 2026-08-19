import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BackOfficeClientsApi } from '../../back-office/back-office-clients-api';
import { BackOfficeClients } from './back-office-clients';

class ClientsApiStub {
  readonly createdNames: Array<string> = [];

  list(): Promise<[]> {
    return Promise.resolve([]);
  }

  create(displayName: string) {
    this.createdNames.push(displayName);
    return Promise.resolve({
      success: true as const,
      result: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' as const,
        displayName,
        archived: false,
      },
    });
  }
}

describe('BackOfficeClients', () => {
  it('creates and displays a client', async () => {
    const api = new ClientsApiStub();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BackOfficeClientsApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(BackOfficeClients);
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
});
