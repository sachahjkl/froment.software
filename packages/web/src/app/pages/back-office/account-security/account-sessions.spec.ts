import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Authentication } from '@backoffice/authentication';
import { AccountSessions } from './account-sessions';

const current = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  current: true,
  startedAt: '2026-09-01T00:00:00.000Z',
  renewedAt: '2026-09-02T00:00:00.000Z',
  expiresAt: '2026-10-01T00:00:00.000Z',
};
const remote = { ...current, id: '01ARZ3NDEKTSV4RRFFQ69G5FAB', current: false };

describe('AccountSessions', () => {
  afterEach(() => vi.restoreAllMocks());
  it('keeps the current session and confirms remote revocation with retry after failure', async () => {
    const listSessions = vi.fn(async () => ({ success: true, result: [current, remote] }));
    const revokeSession = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: Authentication, useValue: { listSessions, revokeSession } }],
    });
    const fixture = TestBed.createComponent(AccountSessions);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('li')).toHaveLength(2);
    expect(root.querySelectorAll('li button')).toHaveLength(1);
    const button = root.querySelector<HTMLButtonElement>('li button');
    if (button === null) throw new Error('session.revoke.missing');
    const confirm = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    button.click();
    await fixture.whenStable();
    expect(revokeSession).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    revokeSession.mockRejectedValueOnce(new Error('offline'));
    button.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelectorAll('li')).toHaveLength(2);
    revokeSession.mockResolvedValueOnce({ success: true });
    button.click();
    await fixture.whenStable();
    expect(revokeSession).toHaveBeenLastCalledWith(remote.id);
    expect(root.querySelectorAll('li')).toHaveLength(1);
    expect(root.textContent).toContain(current.id);
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/fermée|closed/);
    expect(document.activeElement).toBe(root.querySelector('[role="status"]'));
  });
  it('provides a retry after a failed list request', async () => {
    const listSessions = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ success: true, result: [current] });
    TestBed.configureTestingModule({
      providers: [{ provide: Authentication, useValue: { listSessions } }],
    });
    const fixture = TestBed.createComponent(AccountSessions);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    root.querySelector('button')?.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelectorAll('li')).toHaveLength(1);
  });
});
