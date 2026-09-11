import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { ApiTokenPermissionCodes } from '@froment/contracts';
import { vi } from 'vitest';
import { ApiTokensApi } from '@backoffice/api-tokens-api';
import { I18nService } from '@app/i18n.service';
import { installScrollIntoView } from '@shared/filter-choice/filter-choice.spec-helper';
import { Confirmation } from '@shared/confirmation/confirmation';
import { TextCopy } from '@shared/text-copy';
import { ApiTokens } from './api-tokens';
import { ApiTokenEditor } from './api-token-editor';

const token = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'ERP',
  permissions: ['client.read'] as const,
  createdAt: Date.now(),
  expiresAt: Date.now() + 86_400_000,
  lastUsedAt: null,
  revokedAt: null,
  rateLimitPerMinute: 120,
};
const secret = `froment_api_v1_${token.id}.${'a'.repeat(43)}`;
async function openPermissions(fixture: ComponentFixture<ApiTokenEditor>, domain = 'client') {
  const root: HTMLElement = fixture.nativeElement;
  const trigger = [...root.querySelectorAll<HTMLButtonElement>('[ngAccordionTrigger]')].find(
    (button) => button.querySelector('code')?.textContent === domain,
  );
  if (!trigger) throw new Error('Missing permission group');
  if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
  await fixture.whenStable();
}
const fill = async (fixture: ComponentFixture<ApiTokenEditor>) => {
  await openPermissions(fixture);
  const root: HTMLElement = fixture.nativeElement;
  const name = root.querySelector<HTMLInputElement>('#api-token-name');
  const permission = [...root.querySelectorAll('.permission-option')]
    .find((row) => row.querySelector('code')?.textContent === 'client.read')
    ?.querySelector<HTMLInputElement>('input');
  if (!name || !permission) throw new Error('Missing token fields');
  name.value = 'ERP';
  name.dispatchEvent(new Event('input'));
  permission.checked = true;
  permission.dispatchEvent(new Event('change'));
};

function notifyDateValidity(input: HTMLInputElement): void {
  const event = new Event('animationstart');
  Object.defineProperty(event, 'animationName', { value: 'ng-valid' });
  input.dispatchEvent(event);
}

describe('API token pages', () => {
  it('exports only explicit token-list columns and never exports a secret', async () => {
    const withSecret = { ...token, secret };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: async () => ({ items: [withSecret], nextCursor: null }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    expect(fixture.componentInstance['tokenExport']()[0]).toEqual([
      token.name,
      'client.read',
      new Date(token.createdAt).toISOString(),
      new Date(token.expiresAt).toISOString(),
      null,
      'active',
    ]);
    expect(JSON.stringify(fixture.componentInstance['tokenExport']())).not.toContain(secret);
    expect(JSON.stringify(fixture.componentInstance['tokenExport']())).not.toContain(token.id);
  });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    vi.spyOn(Router.prototype, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('allows leaving unchanged values after native expiration validity animations', async () => {
    const create = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiTokensApi, useValue: { create } }],
    });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    const form = component['tokenForm'];
    const initial = structuredClone(form().value());
    expect(initial.expiresAt).not.toBe('');
    notifyDateValidity(root.querySelector<HTMLInputElement>('#api-token-expiration')!);
    const search = root.querySelector<HTMLInputElement>('#api-token-permission-search')!;
    search.value = 'invoice';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(form.expiresAt().dirty()).toBe(true);
    expect(form().touched()).toBe(false);
    expect(form().value()).toEqual(initial);
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(Confirmation.prototype.request).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { selector: '#api-token-name', value: 'ERP' },
    { selector: '#api-token-expiration', value: '2030-10-01T10:00' },
  ])(
    'guards changes to $selector until the initial value is restored',
    async ({ selector, value }) => {
      TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: {} }] });
      vi.mocked(Confirmation.prototype.request).mockResolvedValue(false);
      const fixture = TestBed.createComponent(ApiTokenEditor);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const component = fixture.componentInstance;
      const input = root.querySelector<HTMLInputElement>(selector)!;
      const initial = input.value;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(component['hasUnsavedChanges']()).toBe(true);
      expect(await component.canDeactivate()).toBe(false);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      input.value = initial;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(component['hasUnsavedChanges']()).toBe(false);
      expect(await component.canDeactivate()).toBe(true);
      const restored = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(restored);
      expect(restored.defaultPrevented).toBe(false);
      expect(Confirmation.prototype.request).toHaveBeenCalledOnce();
    },
  );

  it('guards changed permissions until the initial selection is restored', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: {} }] });
    vi.mocked(Confirmation.prototype.request).mockResolvedValue(false);
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    await openPermissions(fixture);
    const permission = root.querySelector<HTMLInputElement>('.permission-option input')!;
    permission.click();
    await fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(await component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    permission.click();
    await fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(true);
    const restored = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(restored);
    expect(restored.defaultPrevented).toBe(false);
    expect(Confirmation.prototype.request).toHaveBeenCalledOnce();
  });

  it('guards incomplete native expiration input when the model remains unchanged', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: {} }] });
    vi.mocked(Confirmation.prototype.request).mockResolvedValue(false);
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    const form = component['tokenForm'];
    const initial = structuredClone(form().value());
    const expiration = root.querySelector<HTMLInputElement>('#api-token-expiration')!;
    const badInput = vi.spyOn(expiration.validity, 'badInput', 'get').mockReturnValue(true);
    expiration.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(form().value()).toEqual(initial);
    expect(form.expiresAt().errors()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'parse' })]),
    );
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(await component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    badInput.mockRestore();
    notifyDateValidity(expiration);
    await fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(true);
    const restored = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(restored);
    expect(restored.defaultPrevented).toBe(false);
    expect(Confirmation.prototype.request).toHaveBeenCalledOnce();
  });

  it('focuses incomplete native expiration input before confirmation or API calls', async () => {
    const create = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiTokensApi, useValue: { create } }],
    });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    await fill(fixture);
    const expiration = root.querySelector<HTMLInputElement>('#api-token-expiration')!;
    const initial = expiration.value;
    vi.spyOn(expiration.validity, 'badInput', 'get').mockReturnValue(true);
    expiration.value = '';
    expiration.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(component['tokenForm'].expiresAt().value()).toBe(initial);
    expect(component['tokenForm'].expiresAt().invalid()).toBe(true);
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(expiration);
    expect(root.querySelector('.field-error')).not.toBeNull();
    expect(Confirmation.prototype.request).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('blocks editor exits while saving even without value changes', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: {} }] });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['saving'].set(true);
    await fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(Confirmation.prototype.request).not.toHaveBeenCalled();
  });

  it('blocks list exits while revoking without inheriting an editor form', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: { list: async () => ({ items: [], nextCursor: null }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.canDeactivate()).toBe(true);
    component['revoking'].set(true);
    expect(component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(Confirmation.prototype.request).not.toHaveBeenCalled();
  });

  it('removes the token chip while preserving search, sort and focus', async () => {
    const queryParamMap = new BehaviorSubject(
      convertToParamMap({ q: 'ERP', sort: 'nameDesc', filter: 'notRevoked' }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { queryParamMap } },
        {
          provide: ApiTokensApi,
          useValue: { list: async () => ({ items: [token], nextCursor: null }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const chip = root.querySelector<HTMLButtonElement>('[appFilterChip]');
    const search = root.querySelector<HTMLInputElement>('app-list-search input');
    expect(chip).toBeTruthy();
    chip?.focus();
    chip?.click();
    await fixture.whenStable();
    expect(Router.prototype.navigate).toHaveBeenCalledExactlyOnceWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { q: 'ERP', sort: 'nameDesc', filter: null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
    queryParamMap.next(convertToParamMap({ q: 'ERP', sort: 'nameDesc' }));
    await fixture.whenStable();
    expect(root.querySelector('[appFilterChip]')).toBeNull();
    expect(document.activeElement).toBe(search);
  });

  it.each([
    {
      language: 'fr',
      count: 0,
      counter: '0 permission',
      confirmation: 'Créer le jeton « ERP » avec 0 permission ?',
    },
    {
      language: 'fr',
      count: 1,
      counter: '1 permission',
      confirmation: 'Créer le jeton « ERP » avec 1 permission ?',
    },
    {
      language: 'fr',
      count: 2,
      counter: '2 permissions',
      confirmation: 'Créer le jeton « ERP » avec 2 permissions ?',
    },
    {
      language: 'en',
      count: 0,
      counter: '0 permissions',
      confirmation: 'Create the token “ERP” with 0 permissions?',
    },
    {
      language: 'en',
      count: 1,
      counter: '1 permission',
      confirmation: 'Create the token “ERP” with 1 permission?',
    },
    {
      language: 'en',
      count: 2,
      counter: '2 permissions',
      confirmation: 'Create the token “ERP” with 2 permissions?',
    },
  ] as const)(
    'formats $count permissions in $language without accepting an empty selection',
    async ({ language, count, counter, confirmation }) => {
      const create = vi.fn();
      TestBed.configureTestingModule({
        providers: [{ provide: ApiTokensApi, useValue: { create } }],
      });
      vi.mocked(Confirmation.prototype.request).mockResolvedValue(false);
      const fixture = TestBed.createComponent(ApiTokenEditor);
      await fixture.whenStable();
      TestBed.inject(I18nService).language.set(language);
      const root: HTMLElement = fixture.nativeElement;
      const name = root.querySelector<HTMLInputElement>('#api-token-name');
      if (!name) throw new Error('Missing token name');
      name.value = 'ERP';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      await openPermissions(fixture);
      const choices = [...root.querySelectorAll<HTMLInputElement>('.permission-option input')];
      for (const choice of choices.slice(0, count)) {
        choice.checked = true;
        choice.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await fixture.whenStable();
      expect(fixture.componentInstance['tokenForm'].permissions().value()).toHaveLength(count);
      expect(root.querySelector('fieldset > p[role="status"]')?.textContent?.trim()).toBe(counter);
      expect(fixture.componentInstance['tokenConfirmation']()).toBe(confirmation);
      const button = root.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (!button) throw new Error('Missing token submit button');
      expect(button.disabled).toBe(false);
      button.click();
      await fixture.whenStable();
      if (count === 0) expect(Confirmation.prototype.request).not.toHaveBeenCalled();
      else expect(Confirmation.prototype.request).toHaveBeenCalledExactlyOnceWith(confirmation);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('opens a filter category and commits a searched choice through the URL', async () => {
    const scrolling = installScrollIntoView();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: { list: async () => ({ items: [token], nextCursor: null }) },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ q: 'ERP', sort: 'nameDesc' })) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    try {
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const trigger = root.querySelector<HTMLButtonElement>('app-filter-menu button');
      if (!trigger) throw new Error('Missing token filter trigger');
      trigger.click();
      await fixture.whenStable();
      const categories = document.querySelectorAll<HTMLButtonElement>(
        '[role="dialog"] [role="menuitem"]',
      );
      expect(categories).toHaveLength(1);
      expect(document.querySelector('[role="dialog"] input')).toBeNull();
      categories[0]?.click();
      await fixture.whenStable();
      const search = document.querySelector<HTMLInputElement>('[role="dialog"] [role="combobox"]');
      if (!search) throw new Error('Missing token filter search');
      expect(document.querySelector('[role="dialog"] select')).toBeNull();
      expect(document.activeElement).toBe(search);
      const label = TestBed.inject(I18nService).t('configurationWorkspace.revokedTokens');
      search.value = label;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(Router.prototype.navigate).not.toHaveBeenCalled();
      const choice = [
        ...document.querySelectorAll<HTMLElement>('[role="dialog"] [role="option"]'),
      ].find((option) => option.textContent?.trim() === label);
      if (!choice) throw new Error('Missing revoked token choice');
      choice.click();
      await fixture.whenStable();
      expect(Router.prototype.navigate).toHaveBeenLastCalledWith([], {
        relativeTo: TestBed.inject(ActivatedRoute),
        queryParams: { q: 'ERP', sort: 'nameDesc', filter: 'revoked' },
        queryParamsHandling: 'merge',
        replaceUrl: false,
      });
      expect(search.isConnected).toBe(false);
      expect(document.activeElement).toBe(trigger);
    } finally {
      fixture.destroy();
      scrolling.restore();
    }
  });

  it('groups all token permissions and searches labels and codes', async () => {
    const list = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: { list } }] });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(
      fixture.componentInstance['permissionGroups']()
        .flatMap((group) => group.permissions.map(({ item }) => item.code))
        .toSorted(),
    ).toEqual([...ApiTokenPermissionCodes].toSorted());
    expect(list).not.toHaveBeenCalled();
    const search = root.querySelector<HTMLInputElement>('#api-token-permission-search');
    if (!search) throw new Error('Missing permission search');
    search.value = 'paid';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(root.querySelectorAll('.permission-option')).toHaveLength(1);
    expect(root.querySelector('.permission-option')?.textContent).toContain('invoice.mark-paid');
    expect(
      fixture.componentInstance['filteredPermissions']()[0]?.codeMatches.length,
    ).toBeGreaterThan(0);
  });

  it('keeps selected permissions when a group closes or a search hides it', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: {} }] });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const component = fixture.componentInstance;
    const initial = structuredClone(component['tokenForm']().value());
    await openPermissions(fixture);
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(component['tokenForm']().value()).toEqual(initial);
    await fill(fixture);
    component['setPermissionGroupExpanded']('client', false);
    await fixture.whenStable();
    expect(component['tokenForm'].permissions().value()).toEqual(['client.read']);
    const search = root.querySelector<HTMLInputElement>('#api-token-permission-search')!;
    search.value = 'paid';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(component['permissionGroups']().some((group) => group.domain === 'client')).toBe(false);
    expect(
      component['permissionGroups']().find((group) => group.domain === 'invoice')?.expanded,
    ).toBe(true);
    root.querySelector<HTMLInputElement>('.permission-option input')!.click();
    await fixture.whenStable();
    search.value = '';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    await openPermissions(fixture);
    const selected = component['tokenForm'].permissions().value();
    expect(selected).toEqual(['client.read', 'invoice.mark-paid']);
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(
      [...root.querySelectorAll<HTMLInputElement>('.permission-option input')].filter(
        (input) => input.checked,
      ),
    ).toHaveLength(2);
  });

  it('keeps invalid submit available and focuses the first invalid field', async () => {
    const create = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiTokensApi, useValue: { create } }],
    });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button?.disabled).toBe(false);
    button?.click();
    await fixture.whenStable();
    expect(create).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(root.querySelector('#api-token-name'));
  });

  it('shows the secret once, guards it and removes it after acknowledgment', async () => {
    const copy = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const create = vi.fn().mockResolvedValue({ success: true, result: { token, secret } });
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiTokensApi, useValue: { create } },
        { provide: TextCopy, useValue: { copy } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(
              convertToParamMap({
                q: 'ERP',
                sort: 'nameDesc',
                filter: 'notRevoked',
                secret: 'discard',
              }),
            ),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    await fill(fixture);
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ERP', permissions: ['client.read'] }),
    );
    expect(root.textContent).toContain(secret);
    expect(root.querySelector('form')).toBeNull();
    expect(fixture.componentInstance['hasUnsavedChanges']()).toBe(false);
    expect(fixture.componentInstance['tokenForm']().disabled()).toBe(true);
    const saved = structuredClone(fixture.componentInstance['tokenForm']().value());
    fixture.componentInstance['togglePermission']('client.read', false);
    fixture.componentInstance['create'](new SubmitEvent('submit'));
    expect(fixture.componentInstance['tokenForm']().value()).toEqual(saved);
    expect(create).toHaveBeenCalledOnce();
    const copyButton = root.querySelector<HTMLButtonElement>('app-copy-field button');
    copyButton?.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    copyButton?.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    vi.mocked(Confirmation.prototype.request).mockResolvedValue(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    expect(Confirmation.prototype.request).toHaveBeenLastCalledWith(
      TestBed.inject(I18nService).t('backOffice.apiTokens.leaveConfirmation'),
    );
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    root.querySelector<HTMLButtonElement>('.tokens-page > button')?.click();
    await fixture.whenStable();
    expect(root.textContent).not.toContain(secret);
    notifyDateValidity(root.querySelector<HTMLInputElement>('#api-token-expiration')!);
    await fixture.whenStable();
    expect(fixture.componentInstance['hasUnsavedChanges']()).toBe(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    const acknowledged = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(acknowledged);
    expect(acknowledged.defaultPrevented).toBe(false);
    expect(create).toHaveBeenCalledOnce();
    expect(Router.prototype.navigate).toHaveBeenLastCalledWith(['/backoffice/api'], {
      queryParams: { q: 'ERP', sort: 'nameDesc', filter: 'notRevoked' },
    });
  });

  it('blocks navigation and repeated creation while the request is pending', async () => {
    type Outcome = {
      success: true;
      result: { token: typeof token; secret: string };
    };
    let resolve: ((outcome: Outcome) => void) | undefined;
    const pending = new Promise<Outcome>((complete) => {
      resolve = complete;
    });
    const create = vi.fn(() => pending);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiTokensApi, useValue: { create } }],
    });
    const fixture = TestBed.createComponent(ApiTokenEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    await fill(fixture);
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    expect(create).toHaveBeenCalledOnce();
    if (!resolve) throw new Error('Missing pending response');
    resolve({ success: true, result: { token, secret } });
    await fixture.whenStable();
    expect(root.textContent).toContain(secret);
  });

  it('keeps list errors distinct from empty data', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.reject(new Error('Unavailable')),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('form')).toBeNull();
  });

  it('merges list pages without duplicate tokens', async () => {
    const next = { ...token, id: '01ARZ3NDEKTSV4RRFFQ69G5FAW', name: 'Next token' };
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [token], nextCursor: token.id })
      .mockResolvedValueOnce({ items: [token, next], nextCursor: null });
    TestBed.configureTestingModule({ providers: [{ provide: ApiTokensApi, useValue: { list } }] });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    await fixture.componentInstance['loadMore']();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(list).toHaveBeenLastCalledWith(token.id);
  });

  it('revokes an active token only after confirmation', async () => {
    const revoke = vi
      .fn()
      .mockResolvedValue({ success: true, result: { ...token, revokedAt: Date.now() } });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: async () => ({ items: [token], nextCursor: null }),
            revoke,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    vi.mocked(Confirmation.prototype.request).mockResolvedValue(false);
    root.querySelector<HTMLButtonElement>('tbody button[data-button-variant="danger"]')?.click();
    await fixture.whenStable();
    expect(revoke).not.toHaveBeenCalled();
    vi.mocked(Confirmation.prototype.request).mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('tbody button[data-button-variant="danger"]')?.click();
    await fixture.whenStable();
    expect(revoke).toHaveBeenCalledWith(token.id);
    expect(root.querySelector('tbody button[data-button-variant="danger"]')).toBeNull();
  });
});
