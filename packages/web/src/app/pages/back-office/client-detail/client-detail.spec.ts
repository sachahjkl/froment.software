import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { ClientDetail } from './client-detail';

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

const configure = (api: Pick<ClientsApi, 'get' | 'update'>) => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ clientId: client.id }) } },
      },
      { provide: ClientsApi, useValue: api },
      { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
    ],
  });
  return TestBed.createComponent(ClientDetail);
};

describe('ClientDetail', () => {
  it('loads and updates a client with its expected version', async () => {
    const update = vi.fn().mockResolvedValue({
      success: true,
      result: { ...client, displayName: 'Acme Conseil', updatedAt: 43 },
    });
    const fixture = configure({
      get: () => Promise.resolve({ success: true as const, result: client }),
      update,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const name = root.querySelector<HTMLInputElement>('#detail-display-name');
    if (name === null) throw new Error('The client name input is unavailable.');

    expect(name.value).toBe('Acme');
    name.value = 'Acme Conseil';
    name.dispatchEvent(new Event('input'));
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith(client.id, {
      displayName: 'Acme Conseil',
      addressLine1: client.addressLine1,
      addressLine2: '',
      postalCode: client.postalCode,
      city: client.city,
      country: client.country,
      email: client.email,
      expectedUpdatedAt: 42,
    });
    expect(root.textContent).toMatch(/Client enregistré|Client saved/);
  });

  it('shows local validation and a version conflict', async () => {
    const update = vi.fn().mockResolvedValue({
      success: false,
      code: 'client.version_conflict',
    });
    const fixture = configure({
      get: () => Promise.resolve({ success: true as const, result: client }),
      update,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const email = root.querySelector<HTMLInputElement>('#detail-email');
    const name = root.querySelector<HTMLInputElement>('#detail-display-name');
    if (email === null || name === null) throw new Error('The client fields are unavailable.');

    email.value = 'invalid';
    email.dispatchEvent(new Event('input'));
    email.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#detail-email-error')?.textContent).toMatch(/e-mail|email/);

    email.value = client.email;
    email.dispatchEvent(new Event('input'));
    name.value = 'Changed';
    name.dispatchEvent(new Event('input'));
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/ailleurs|elsewhere/);
  });

  it('disables an archived client form', async () => {
    const fixture = configure({
      get: () => Promise.resolve({ success: true as const, result: { ...client, archived: true } }),
      update: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector<HTMLInputElement>('#detail-display-name')?.disabled).toBe(true);
    expect(root.querySelector('button[type="submit"]')).toBeNull();
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('asks before leaving a dirty client form', async () => {
    const fixture = configure({
      get: () => Promise.resolve({ success: true as const, result: client }),
      update: vi.fn(),
    });
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const name = root.querySelector<HTMLInputElement>('#detail-display-name');
    if (name === null) throw new Error('The client name input is unavailable.');
    name.value = 'Changed';
    name.dispatchEvent(new Event('input'));
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);

    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });
});
