import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { IntegrationTokensApi } from '@backoffice/integration-tokens-api';
import { IntegrationTokens } from './integration-tokens';

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
const secret = `froment_it_v1_${token.id}.${'a'.repeat(43)}`;
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

describe('IntegrationTokens', () => {
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
          provide: IntegrationTokensApi,
          useValue: { list, create, revoke: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(IntegrationTokens);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#integration-token-name')!;
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
    const create = vi.fn().mockResolvedValue({
      success: true,
      result: { token, secret },
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: IntegrationTokensApi,
          useValue: {
            list: () => Promise.resolve({ items: [], nextCursor: null }),
            create,
            revoke: vi.fn(),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(IntegrationTokens);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const dialog = root.querySelector<HTMLDialogElement>('dialog')!;
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    root.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#integration-token-name')!;
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

    const acknowledge = root.querySelector<HTMLButtonElement>(
      'dialog section.dialog-content > button',
    );
    expect(acknowledge).not.toBeNull();
    acknowledge?.click();
    await fixture.whenStable();
    expect(root.textContent).not.toContain(secret);
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
          provide: IntegrationTokensApi,
          useValue: {
            list: () => Promise.resolve({ items: [token], nextCursor: null }),
            create: vi.fn(),
            revoke,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(IntegrationTokens);
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
