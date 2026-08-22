import { TestBed } from '@angular/core/testing';
import { ApiTokenPermissionCodes } from '@froment/contracts';
import { vi } from 'vitest';

import { ApiTokensApi } from '@backoffice/api-tokens-api';
import { TextCopy } from '@shared/text-copy';
import { ApiTokens } from './api-tokens';

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
const serverToken = {
  ...token,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  name: 'Server token',
};
const nextToken = {
  ...token,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  name: 'Next token',
};

describe('ApiTokens', () => {
  it('lists every API token permission and filters labels with fuzzy search', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.resolve({ items: [], nextCursor: null }),
            create: vi.fn(),
            revoke: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    expect(root.querySelectorAll('.permission-grid tbody tr')).toHaveLength(
      ApiTokenPermissionCodes.length,
    );
    const search = root.querySelector<HTMLInputElement>('#api-token-permission-search')!;
    search.value = 'paid';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const rows = root.querySelectorAll('.permission-grid tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('invoice.mark-paid');
    expect(
      fixture.componentInstance['filteredPermissions']()[0]?.codeMatches.length,
    ).toBeGreaterThan(0);
  });

  it('merges a creation with initial and subsequent list pages', async () => {
    let resolveList!: (page: {
      items: ReadonlyArray<typeof serverToken>;
      nextCursor: typeof serverToken.id;
    }) => void;
    const list = vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (resolveList = resolve)))
      .mockResolvedValueOnce({ items: [serverToken, nextToken], nextCursor: null });
    const create = vi.fn().mockResolvedValue({
      success: true,
      result: { token, secret },
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: { list, create, revoke: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#api-token-name')!;
    name.value = 'ERP';
    name.dispatchEvent(new Event('input'));
    const permission = root.querySelector<HTMLInputElement>('.permission-grid input')!;
    permission.checked = true;
    permission.dispatchEvent(new Event('change'));
    root.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    const acknowledge = root.querySelector<HTMLButtonElement>(
      'dialog section.dialog-content > button',
    );
    expect(acknowledge).not.toBeNull();
    acknowledge?.click();
    await fixture.whenStable();
    resolveList({ items: [serverToken], nextCursor: serverToken.id });
    await vi.waitFor(() => expect(root.textContent).not.toMatch(/Loading tokens|Chargement/));

    expect(root.textContent).toContain('ERP');
    expect(root.textContent).toContain('Server token');
    const loadMore = [
      ...root.querySelectorAll<HTMLButtonElement>('section.tokens-page > button'),
    ].at(-1);
    loadMore?.click();
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith(serverToken.id);
    expect(root.textContent).toContain('Next token');
    expect(root.textContent?.match(/Server token/g)).toHaveLength(1);
  });

  it('shows a created secret once and clears it when acknowledged', async () => {
    const copy = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const create = vi.fn().mockResolvedValue({
      success: true,
      result: { token, secret },
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.resolve({ items: [], nextCursor: null }),
            create,
            revoke: vi.fn(),
          },
        },
        { provide: TextCopy, useValue: { copy } },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#api-token-name')!;
    name.value = 'ERP';
    name.dispatchEvent(new Event('input'));
    const permission = root.querySelector<HTMLInputElement>('.permission-grid input')!;
    permission.checked = true;
    permission.dispatchEvent(new Event('change'));
    root.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ERP', permissions: ['client.read'] }),
    );
    expect(root.textContent).toContain(secret);
    const copyButton = root.querySelector<HTMLButtonElement>('app-copy-field button')!;
    copyButton.click();
    await fixture.whenStable();
    expect(root.querySelector('dialog [role="alert"]')).not.toBeNull();
    copyButton.click();
    await fixture.whenStable();
    expect(root.querySelector('dialog [role="alert"]')).toBeNull();
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();

    const acknowledge = root.querySelector<HTMLButtonElement>(
      'dialog section.dialog-content > button',
    );
    expect(acknowledge).not.toBeNull();
    acknowledge?.click();
    await fixture.whenStable();
    expect(root.textContent).not.toContain(secret);
    expect(fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('does not present a failed initial load as an empty list', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.reject(new Error('Unavailable')),
            create: vi.fn(),
            revoke: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.tokens-page [role="alert"]')).not.toBeNull();
    expect(root.querySelector('.empty')).toBeNull();
  });

  it('blocks route deactivation while token creation is pending', async () => {
    let resolveCreate!: (outcome: {
      success: true;
      result: { token: typeof token; secret: string };
    }) => void;
    const create = vi.fn().mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));
    const confirm = vi.spyOn(globalThis, 'confirm');
    confirm.mockClear();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.resolve({ items: [], nextCursor: null }),
            create,
            revoke: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#api-token-name')!;
    name.value = 'ERP';
    name.dispatchEvent(new Event('input'));
    const permission = root.querySelector<HTMLInputElement>('.permission-grid input')!;
    permission.checked = true;
    permission.dispatchEvent(new Event('change'));
    root.querySelector<HTMLFormElement>('dialog form')!.dispatchEvent(new SubmitEvent('submit'));
    await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());

    expect(fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    const beforeUnload = new Event('beforeunload', { cancelable: true });
    globalThis.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    resolveCreate({ success: true, result: { token, secret } });
    await fixture.whenStable();
    expect(root.textContent).toContain(secret);
  });

  it('lists token status and revokes an active token once confirmed', async () => {
    const revoke = vi.fn().mockResolvedValue({
      success: true,
      result: { ...token, revokedAt: Date.now() },
    });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ApiTokensApi,
          useValue: {
            list: () => Promise.resolve({ items: [token], nextCursor: null }),
            create: vi.fn(),
            revoke,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ApiTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const revokeButton = root.querySelector<HTMLButtonElement>('tbody button');
    expect(root.querySelector('tbody [appBadge]')?.classList).toContain('ok');
    revokeButton?.click();
    await fixture.whenStable();

    expect(revoke).toHaveBeenCalledWith(token.id);
    expect(root.querySelector('tbody [appBadge]')?.classList).toContain('err');
    expect(root.querySelector('tbody button')).toBeNull();
  });
});
