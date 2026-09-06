import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { TeamApi } from '@backoffice/team-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Team } from './team';
import { TeamJoin } from './team-join';

describe('Team', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
  });
  it('preserves invitation content and the request key after a failed response and guards the displayed link', async () => {
    const invite = vi
      .fn()
      .mockResolvedValueOnce({ success: false, code: 'team.error' })
      .mockResolvedValueOnce({
        success: true,
        result: { url: 'https://example.test/backoffice/join#secret' },
      });
    const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TeamApi,
          useValue: {
            list: async () => ({ success: true, result: { invitations: [], members: [] } }),
            invite,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Team);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const fields = root.querySelectorAll<HTMLInputElement>('form input');
    for (const [index, text] of ['Team member', 'team@example.test'].entries()) {
      const field = fields[index];
      if (!field) throw new Error('team.test.field_missing');
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
      root
        .querySelector('form')
        ?.dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true }));
      await fixture.whenStable();
    }
    expect(invite).toHaveBeenCalledTimes(2);
    expect(invite.mock.calls[0]).toEqual(invite.mock.calls[1]);
    expect(root.querySelector<HTMLInputElement>('input[readonly]')?.value).toContain('#secret');
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirmation).toHaveBeenCalled();
    const dismiss = [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      /conservé|saved the link/.test(button.textContent),
    );
    dismiss?.click();
    await fixture.whenStable();
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });
  it('clears the fragment and passwords after invitation acceptance', async () => {
    const token = 'A'.repeat(43);
    window.history.replaceState({}, '', `/backoffice/join#${token}`);
    const accept = vi.fn(async () => ({ success: true, result: null }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TeamApi, useValue: { accept } }],
    });
    const fixture = TestBed.createComponent(TeamJoin);
    await fixture.whenStable();
    expect(window.location.hash).toBe('');
    const root: HTMLElement = fixture.nativeElement;
    for (const field of root.querySelectorAll<HTMLInputElement>('input')) {
      field.value = 'invitation-password-123';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    root
      .querySelector('form')
      ?.dispatchEvent(new SubmitEvent('submit', { cancelable: true, bubbles: true }));
    await fixture.whenStable();
    expect(accept).toHaveBeenCalledWith({ token, password: 'invitation-password-123' });
    expect(root.querySelector('form')).toBeNull();
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });
});
