import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ClientEditor } from './client-editor';

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
@Component({ template: '<h1>Client</h1>' })
class ClientDestination {}

async function configure(editing = false, value = client, loadError = false, query = '') {
  const api = {
    get: vi
      .fn()
      .mockResolvedValue(
        loadError ? { success: false, code: 'client.error' } : { success: true, result: value },
      ),
    create: vi.fn().mockResolvedValue({ success: true, result: value }),
    update: vi.fn().mockResolvedValue({ success: true, result: value }),
  };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'backoffice/clients/new',
          component: ClientEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/clients/:clientId/edit',
          component: ClientEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        { path: 'backoffice/clients/:clientId', component: ClientDestination },
        { path: 'backoffice/clients', component: ClientDestination },
      ]),
      { provide: ClientsApi, useValue: api },
      { provide: Confirmation, useValue: confirmation },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const path = editing ? `/backoffice/clients/${client.id}/edit` : '/backoffice/clients/new';
  const component = await harness.navigateByUrl(`${path}${query}`, ClientEditor);
  await harness.fixture.whenStable();
  const root = harness.fixture.nativeElement as HTMLElement;
  const fill = async (field: string, text: string) => {
    const input = root.querySelector<HTMLInputElement>(`#client-${field}`)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await harness.fixture.whenStable();
  };
  const save = async () => {
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit'));
    await harness.fixture.whenStable();
  };
  return {
    api,
    root,
    component,
    confirmation,
    fill,
    save,
    fixture: harness.fixture,
    router: TestBed.inject(Router),
  };
}

describe('ClientEditor', () => {
  it('creates an incomplete client and opens the saved detail page', async () => {
    const { api, fill, save, router } = await configure();
    await fill('displayName', 'Acme');
    await save();
    expect(api.create).toHaveBeenCalledWith({
      displayName: 'Acme',
      email: '',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
    });
    expect(router.url).toBe(`/backoffice/clients/${client.id}`);
  });

  it('shows validation without submitting an invalid client', async () => {
    const { root, api, fill, save } = await configure();
    await save();
    expect(root.querySelector('#client-displayName')?.getAttribute('aria-invalid')).toBe('true');
    await fill('displayName', 'Acme');
    await fill('email', 'invalid');
    await save();
    expect(root.querySelector('#client-email-error')?.textContent).toMatch(/e-mail|email/);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('retains the draft after a version conflict and submits the expected version', async () => {
    const { api, root, fill, save } = await configure(true);
    api.update.mockResolvedValue({ success: false, code: 'client.version_conflict' });
    await fill('displayName', 'Acme Conseil');
    await save();
    expect(api.update).toHaveBeenCalledWith(client.id, {
      displayName: 'Acme Conseil',
      email: client.email,
      addressLine1: client.addressLine1,
      addressLine2: '',
      postalCode: client.postalCode,
      city: client.city,
      country: client.country,
      expectedUpdatedAt: 42,
    });
    expect(root.querySelector<HTMLInputElement>('#client-displayName')?.value).toBe('Acme Conseil');
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/elsewhere|ailleurs/);
  });

  it('protects dirty fields with a route confirmation and native unload guard', async () => {
    const { fill, component, confirmation, router } = await configure(true);
    await fill('displayName', 'Changed');
    expect(await component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(await router.navigateByUrl('/backoffice/clients')).toBe(false);
    confirmation.request.mockResolvedValue(true);
    expect(await router.navigateByUrl('/backoffice/clients')).toBe(true);
  });

  it('blocks duplicate saves and navigation during a request', async () => {
    const { fill, api, save, root, component } = await configure();
    api.create.mockReturnValue(new Promise(() => {}));
    await fill('displayName', 'Pending');
    await save();
    await save();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLInputElement>('#client-displayName')?.disabled).toBe(true);
    expect(await component.canDeactivate()).toBe(false);
  });

  it('does not expose an archived client as an editable form', async () => {
    const { root, component } = await configure(true, { ...client, archived: true });
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    expect(await component.canDeactivate()).toBe(true);
  });

  it('keeps a failed client load separate from an editable form', async () => {
    const { root, api, fixture } = await configure(true, client, true);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    api.get.mockResolvedValue({ success: true, result: client });
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#client-displayName')?.value).toBe('Acme');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it.each(['a[pageBack]', '.actions a'])(
    'retains allowed context through the return link %s',
    async (selector) => {
      const query =
        '?q=Acme&view=archived&country=France&contact=incomplete&sort=name-desc&clientAffairStatus=accepted&clientDocumentType=invoice&clientAccessQ=portal&clientAccessFrom=2026-09-01&returnUrl=https://example.test&token=secret';
      const { root, fixture, router } = await configure(true, client, false, query);
      root.querySelector<HTMLAnchorElement>(selector)!.click();
      await fixture.whenStable();
      const destination = router.parseUrl(router.url);
      expect(destination.root.children['primary']?.segments.map(({ path }) => path)).toEqual([
        'backoffice',
        'clients',
        client.id,
      ]);
      expect(destination.queryParams).toEqual({
        q: 'Acme',
        view: 'archived',
        country: 'France',
        contact: 'incomplete',
        sort: 'name-desc',
        clientAffairStatus: 'accepted',
        clientDocumentType: 'invoice',
        clientAccessQ: 'portal',
        clientAccessFrom: '2026-09-01',
      });
    },
  );

  it('retains allowed context after saving without adding a leave confirmation', async () => {
    const query =
      '?q=Acme&view=all&clientAffairSort=amountDesc&clientDocumentSort=dateAsc&clientAccessSort=emailDesc&clientAccessTo=2026-09-30&returnUrl=/backoffice/team';
    const { fill, save, router, confirmation } = await configure(true, client, false, query);
    await fill('displayName', 'Acme Conseil');
    await save();
    const destination = router.parseUrl(router.url);
    expect(destination.root.children['primary']?.segments.map(({ path }) => path)).toEqual([
      'backoffice',
      'clients',
      client.id,
    ]);
    expect(destination.queryParams).toEqual({
      q: 'Acme',
      view: 'all',
      clientAffairSort: 'amountDesc',
      clientDocumentSort: 'dateAsc',
      clientAccessSort: 'emailDesc',
      clientAccessTo: '2026-09-30',
    });
    expect(confirmation.request).not.toHaveBeenCalled();
  });
});
