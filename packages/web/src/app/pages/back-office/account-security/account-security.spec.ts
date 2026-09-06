import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Authentication } from '@backoffice/authentication';
import { AccountSecurity } from './account-security';

describe('AccountSecurity', () => {
  afterEach(() => vi.restoreAllMocks());
  it.each([true, false])('clears passwords after the request, success=%s', async (success) => {
    const changePassword = vi.fn(async () =>
      success
        ? { success: true }
        : { success: false, code: 'authentication.password_change_rejected' },
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Authentication,
          useValue: { changePassword, listSessions: async () => ({ success: true, result: [] }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(AccountSecurity);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const fields = root.querySelectorAll<HTMLInputElement>('input');
    for (const [index, value] of [
      'old-password-123',
      'new-password-123',
      'new-password-123',
    ].entries()) {
      const field = fields[index];
      if (field === undefined) throw new Error('password.field.missing');
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const confirm = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    root
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(changePassword).not.toHaveBeenCalled();
    confirm.mockResolvedValue(true);
    root
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password-123',
      newPassword: 'new-password-123',
    });
    for (const field of root.querySelectorAll<HTMLInputElement>('input'))
      expect(field.value).toBe('');
    expect(root.querySelector(success ? '[role="status"]' : '[role="alert"]')).not.toBeNull();
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });
});
import { Confirmation } from '@shared/confirmation/confirmation';
