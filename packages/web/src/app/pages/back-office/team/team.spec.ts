import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { TeamApi } from '@backoffice/team-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { TeamInvitation } from './team-invitation';
import { TeamJoin } from './team-join';
import { Team } from './team';

describe('Team', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
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
  it.each(['team.email_exists', 'team.invitation_exists', 'team.invitation_limit'])(
    'releases a request rejected before creation by %s without clearing the form',
    async (code) => {
      const invite = vi
        .fn()
        .mockResolvedValueOnce({ success: false, code })
        .mockResolvedValueOnce({
          success: true,
          result: { url: 'https://example.test/backoffice/join#secret' },
        });
      const list = vi.fn();
      const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: TeamApi, useValue: { invite, list } }],
      });
      const fixture = TestBed.createComponent(TeamInvitation);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      const form = component['invitationForm'];
      const values = {
        displayName: 'Team member',
        email: 'existing@example.test',
        profile: 'collaborator',
      };
      form().value.set(values);
      form().markAsDirty();
      await component['invite'](new Event('submit'));
      await fixture.whenStable();
      expect(component['pending']()).toBeUndefined();
      expect(component['busy']()).toBe(false);
      expect(component['error']()).toBe(code);
      expect(form().disabled()).toBe(false);
      expect(form().value()).toEqual(values);
      expect(form().dirty()).toBe(true);
      confirmation.mockResolvedValueOnce(false);
      expect(await component.canDeactivate()).toBe(false);
      form.email().value.set('available@example.test');
      await component['invite'](new Event('submit'));
      await fixture.whenStable();
      expect(invite).toHaveBeenCalledTimes(2);
      expect(invite.mock.calls[1]?.[0].requestId).not.toBe(invite.mock.calls[0]?.[0].requestId);
      expect(invite.mock.calls[1]?.[0].email).toBe('available@example.test');
      expect(component['link']()).toContain('#secret');
      expect(list).not.toHaveBeenCalled();
    },
  );

  it.each(['team.error', 'team.invitation_permission', 'team.invitation_changed'])(
    'keeps the exact request after %s when prior creation is not excluded',
    async (code) => {
      const invite = vi.fn().mockResolvedValue({ success: false, code });
      const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: TeamApi, useValue: { invite } }],
      });
      const fixture = TestBed.createComponent(TeamInvitation);
      await fixture.whenStable();
      const component = fixture.componentInstance;
      const form = component['invitationForm'];
      form().value.set({
        displayName: 'Team member',
        email: 'team@example.test',
        profile: 'collaborator',
      });
      await component['invite'](new Event('submit'));
      await fixture.whenStable();
      const request = invite.mock.calls[0]?.[0];
      expect(component['pending']()).toBe(request);
      expect(form().disabled()).toBe(true);
      confirmation.mockResolvedValueOnce(false);
      expect(await component.canDeactivate()).toBe(false);
      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
      form().value.set({
        displayName: 'Changed',
        email: 'changed@example.test',
        profile: 'accountant',
      });
      await component['invite'](new Event('submit'));
      expect(invite.mock.calls[1]?.[0]).toBe(request);
      expect(component['pending']()).toBe(request);
    },
  );

  it('keeps an uncertain request after a thrown transport failure', async () => {
    const invite = vi.fn().mockRejectedValue(new Error('Unavailable'));
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TeamApi, useValue: { invite } }],
    });
    const fixture = TestBed.createComponent(TeamInvitation);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['invitationForm']().value.set({
      displayName: 'Team member',
      email: 'team@example.test',
      profile: 'collaborator',
    });
    await component['invite'](new Event('submit'));
    expect(component['busy']()).toBe(false);
    expect(component['error']()).toBe('team.error');
    expect(component['pending']()).toBe(invite.mock.calls[0]?.[0]);
    expect(component['invitationForm']().disabled()).toBe(true);
  });

  it('blocks repeated invitations and exits while the request is pending', async () => {
    type Outcome = { success: false; code: 'team.error' };
    let resolve: ((outcome: Outcome) => void) | undefined;
    const response = new Promise<Outcome>((complete) => {
      resolve = complete;
    });
    const invite = vi.fn(() => response);
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TeamApi, useValue: { invite } }],
    });
    const fixture = TestBed.createComponent(TeamInvitation);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['invitationForm']().value.set({
      displayName: 'Team member',
      email: 'team@example.test',
      profile: 'collaborator',
    });
    const submission = component['invite'](new Event('submit'));
    await vi.waitFor(() => expect(invite).toHaveBeenCalledOnce());
    expect(component.canDeactivate()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await component['invite'](new Event('submit'));
    expect(invite).toHaveBeenCalledOnce();
    if (!resolve) throw new Error('Missing invitation response');
    resolve({ success: false, code: 'team.error' });
    await submission;
    expect(component['busy']()).toBe(false);
    expect(component['pending']()).toBeDefined();
  });

  it('cancels confirmation without reserving a request or clearing the form', async () => {
    const invite = vi.fn();
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TeamApi, useValue: { invite } }],
    });
    const fixture = TestBed.createComponent(TeamInvitation);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const values = {
      displayName: 'Team member',
      email: 'team@example.test',
      profile: 'collaborator',
    };
    component['invitationForm']().value.set(values);
    await component['invite'](new Event('submit'));
    expect(component['pending']()).toBeUndefined();
    expect(component['busy']()).toBe(false);
    expect(component['invitationForm']().disabled()).toBe(false);
    expect(component['invitationForm']().value()).toEqual(values);
    expect(invite).not.toHaveBeenCalled();
  });

  it('retains both table queries in the invitation return link without unknown parameters', async () => {
    const params = {
      memberQ: 'Alice',
      memberSort: 'nameDesc',
      memberFilter: 'active',
      invitationQ: 'Bob',
      invitationSort: 'dateAsc',
      invitationFilter: 'accountant',
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: new BehaviorSubject(convertToParamMap({ ...params, secret: 'discard' })),
          },
        },
        { provide: TeamApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(TeamInvitation);
    await fixture.whenStable();
    expect(fixture.componentInstance['navigation'].params()).toEqual(params);
  });

  it.each([
    {
      table: 'members',
      parameter: 'memberFilter',
      query: 'memberQ',
      sort: 'memberSort',
      filter: 'active',
    },
    {
      table: 'invitations',
      parameter: 'invitationFilter',
      query: 'invitationQ',
      sort: 'invitationSort',
      filter: 'accountant',
    },
  ] as const)(
    'removes the $table chip without changing search, sort or the other table',
    async ({ table, parameter, query, sort, filter }) => {
      const params = {
        memberQ: 'Alice',
        memberSort: 'nameDesc',
        memberFilter: 'active',
        invitationQ: 'Bob',
        invitationSort: 'dateAsc',
        invitationFilter: 'accountant',
      };
      const queryParamMap = new BehaviorSubject(convertToParamMap(params));
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: ActivatedRoute, useValue: { queryParamMap } },
          {
            provide: TeamApi,
            useValue: {
              list: async () => ({ success: true, result: { members: [], invitations: [] } }),
            },
          },
        ],
      });
      const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(Team);
      await fixture.whenStable();
      await vi.waitFor(() => expect(fixture.componentInstance['loading']()).toBe(false));
      await fixture.whenStable();
      expect(fixture.componentInstance[table].query().filter).toBe(filter);
      const root: HTMLElement = fixture.nativeElement;
      const section = root.querySelector<HTMLElement>(`[aria-labelledby="${table}-title"]`);
      const chip = section?.querySelector<HTMLButtonElement>('[appFilterChip]');
      const search = section?.querySelector<HTMLInputElement>('app-list-search input');
      expect(chip).toBeTruthy();
      chip?.focus();
      chip?.click();
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalledExactlyOnceWith([], {
        relativeTo: TestBed.inject(ActivatedRoute),
        queryParams: { [parameter]: null, [query]: params[query], [sort]: params[sort] },
        queryParamsHandling: 'merge',
        replaceUrl: false,
      });
      queryParamMap.next(convertToParamMap({ ...params, [parameter]: undefined }));
      await fixture.whenStable();
      expect(section?.querySelector('[appFilterChip]')).toBeNull();
      expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(1);
      expect(document.activeElement).toBe(search);
    },
  );
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
