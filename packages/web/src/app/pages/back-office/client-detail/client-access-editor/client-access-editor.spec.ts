import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ClientAccessEditor } from './client-access-editor';

@Component({ template: '' })
class AccessList {}
const client = { id: '01ARZ3NDEKTSV4RRFFQ69G5FAV', displayName: 'Acme', archived: false };

async function configure() {
  const api = {
    get: vi.fn().mockResolvedValue({ success: true, result: client }),
    createAccess: vi
      .fn()
      .mockResolvedValue({ success: true, result: { email: 'portal@acme.test' } }),
  };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'backoffice/clients/:clientId/access/new',
          component: ClientAccessEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        { path: 'backoffice/clients/:clientId/access', component: AccessList },
      ]),
      { provide: ClientsApi, useValue: api },
      { provide: Confirmation, useValue: confirmation },
    ],
  });
  const harness = await RouterTestingHarness.create(`/backoffice/clients/${client.id}/access/new`);
  await harness.fixture.whenStable();
  return { harness, root: harness.routeNativeElement!, api, confirmation };
}

describe('ClientAccessEditor', () => {
  it('keeps invalid submission enabled and focuses the first invalid field', async () => {
    const { root, harness, api } = await configure();
    expect(root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('[type="submit"]')!.click();
    await harness.fixture.whenStable();
    expect(document.activeElement?.id).toBe('client-account-email');
    expect(root.querySelector('#client-account-password-error')).not.toBeNull();
    expect(api.createAccess).not.toHaveBeenCalled();
  });

  it('guards dirty access fields and returns to the list after creation', async () => {
    const { root, harness, api, confirmation } = await configure();
    const email = root.querySelector<HTMLInputElement>('#client-account-email')!;
    const password = root.querySelector<HTMLInputElement>('#client-account-password')!;
    email.value = 'portal@acme.test';
    email.dispatchEvent(new Event('input'));
    password.value = 'secure-password-for-client';
    password.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    const back = `/backoffice/clients/${client.id}/access`;
    await harness.navigateByUrl(back);
    expect(TestBed.inject(Router).url).toBe(`${back}/new`);
    expect(confirmation.request).toHaveBeenCalledOnce();
    root.querySelector<HTMLButtonElement>('[type="submit"]')!.click();
    await harness.fixture.whenStable();
    expect(api.createAccess).toHaveBeenCalledWith(client.id, {
      email: 'portal@acme.test',
      password: 'secure-password-for-client',
    });
    expect(TestBed.inject(Router).url).toBe(back);
  });
});
