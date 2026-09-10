import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { TeamApi } from '@backoffice/team-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { TeamInvitation } from './team-invitation';
import { TeamJoin } from './team-join';
import { Team } from './team';

describe('Team', () => {
  it('exports team state without personal fields or invitation links', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TeamApi,
          useValue: {
            list: async () => ({
              success: true,
              result: {
                members: [
                  {
                    id: 'private-id',
                    displayName: 'Private Name',
                    email: 'private@example.test',
                    profile: 'accountant',
                    version: 2,
                    disabledAt: null,
                  },
                ],
                invitations: [
                  {
                    id: 'private-invitation',
                    displayName: 'Other Name',
                    email: 'other@example.test',
                    profile: 'collaborator',
                    createdAt: 0,
                    expiresAt: 1,
                    acceptedAt: null,
                    cancelledAt: null,
                  },
                ],
              },
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Team);
    await fixture.whenStable();
    expect(fixture.componentInstance['memberExport']()).toEqual([['accountant', 'active', 2]]);
    expect(fixture.componentInstance['invitationExport']()[0]).toEqual([
      'collaborator',
      new Date(0).toISOString(),
      new Date(1).toISOString(),
      'expired',
    ]);
    const exported = JSON.stringify([
      fixture.componentInstance['memberExport'](),
      fixture.componentInstance['invitationExport'](),
    ]);
    expect(exported).not.toContain('private');
    expect(exported).not.toContain('@');
    expect(exported).not.toContain('Name');
  });
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
    const fixture = TestBed.createComponent(TeamInvitation);
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
    const profile = root.querySelector<HTMLSelectElement>('select');
    expect(profile?.value).toBe('');
    if (!profile) throw new Error('Missing profile selector');
    profile.value = 'collaborator';
    profile.dispatchEvent(new Event('input', { bubbles: true }));
    profile.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    expect(profile.value).toBe('collaborator');
    expect(fixture.componentInstance['invitationForm']().value()).toEqual({
      displayName: 'Team member',
      email: 'team@example.test',
      profile: 'collaborator',
    });
    expect(fixture.componentInstance['invitationForm']().invalid()).toBe(false);
    confirmation.mockResolvedValue(true);
    for (let attempt = 0; attempt < 2; attempt++) {
      const submit = root.querySelector<HTMLButtonElement>('form button[type="submit"]');
      if (!submit) throw new Error('Missing invitation submit button');
      expect(submit.disabled).toBe(false);
      submit.click();
      await fixture.whenStable();
      expect(invite).toHaveBeenCalledTimes(attempt + 1);
    }
    expect(invite).toHaveBeenCalledTimes(2);
    expect(invite.mock.calls[0]).toEqual(invite.mock.calls[1]);
    expect(invite.mock.calls[0]?.[0]).toMatchObject({ profile: 'collaborator' });
    expect(root.querySelector<HTMLInputElement>('input[readonly]')?.value).toContain('#secret');
    confirmation.mockResolvedValue(false);
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
