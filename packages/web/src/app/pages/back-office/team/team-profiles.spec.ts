import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TeamList, TeamMemberUpdate } from '@froment/contracts';
import { vi } from 'vitest';
import { TeamApi } from '@backoffice/team-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Team } from './team';

const firstId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const secondId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const invitationId = '97b85b47-577a-44db-b62a-5c0c7622b461';
const setup = async () => {
  let data: typeof TeamList.Type = {
    members: [firstId, secondId].map((id) => ({
      id,
      displayName: id,
      email: `${id}@example.test`,
      profile: 'accountant',
      version: 1,
      disabledAt: null,
    })),
    invitations: [
      {
        id: invitationId,
        displayName: 'Invited',
        email: 'invited@example.test',
        profile: 'collaborator',
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
        acceptedAt: null,
        cancelledAt: null,
      },
    ],
  };
  const api = {
    list: vi.fn(async () => ({ success: true as const, result: structuredClone(data) })),
    update: vi.fn(async (id: string, request: typeof TeamMemberUpdate.Type) => {
      data = {
        ...data,
        members: data.members.map((member) =>
          member.id === id
            ? {
                ...member,
                profile: request.profile,
                disabledAt: request.disabled ? 42 : null,
                version: member.version + 1,
              }
            : member,
        ),
      };
      return { success: true as const, result: null };
    }),
    cancel: vi.fn(async (id: string) => {
      data = {
        ...data,
        invitations: data.invitations.map((invitation) =>
          invitation.id === id
            ? {
                ...invitation,
                cancelledAt: 42,
              }
            : invitation,
        ),
      };
      return { success: true as const, result: null };
    }),
  };
  const confirmation = { request: vi.fn(async () => true) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TeamApi, useValue: api },
      { provide: Confirmation, useValue: confirmation },
    ],
  });
  const fixture = TestBed.createComponent(Team);
  await fixture.whenStable();
  const component = fixture.componentInstance;
  const edit = (id: string) => {
    component['profileForm'][id]().value.set('collaborator');
    component['profileForm'][id]().markAsDirty();
  };
  const member = (id: string) => {
    const value = component['data']().members.find((item) => item.id === id);
    if (!value) throw new Error('team.test.member_missing');
    return value;
  };
  return { fixture, component, api, confirmation, edit, member };
};

describe('team profile drafts', () => {
  it('updates the saved row without discarding other profiles or advancing their versions', async () => {
    const { fixture, component, api, confirmation, edit, member } = await setup();
    edit(firstId);
    edit(secondId);
    const originalList = await api.list();
    api.list.mockResolvedValueOnce({
      success: true,
      result: {
        ...originalList.result,
        members: originalList.result.members.map((item) => ({
          ...item,
          profile: 'collaborator',
          version: 2,
        })),
      },
    });
    await component['applyProfile'](member(firstId));
    await fixture.whenStable();
    expect(member(firstId)).toMatchObject({ profile: 'collaborator', version: 2 });
    expect(member(secondId)).toMatchObject({ profile: 'accountant', version: 1 });
    expect(component['profileForm'][secondId]().value()).toBe('collaborator');
    expect(component['hasUnsavedChanges']()).toBe(true);
    confirmation.request.mockResolvedValueOnce(false);
    expect(await component.canDeactivate()).toBe(false);
    await component['applyProfile'](member(secondId));
    expect(api.update).toHaveBeenLastCalledWith(secondId, {
      expectedVersion: 1,
      profile: 'collaborator',
      disabled: false,
    });
    expect(component['hasUnsavedChanges']()).toBe(false);
  });

  it('keeps an unapplied profile when disabling the same account', async () => {
    const { fixture, component, api, edit, member } = await setup();
    edit(firstId);
    await component['update'](member(firstId), 'accountant', true);
    await fixture.whenStable();
    expect(api.update).toHaveBeenCalledWith(firstId, {
      expectedVersion: 1,
      profile: 'accountant',
      disabled: true,
    });
    expect(member(firstId)).toMatchObject({ profile: 'accountant', disabledAt: 42, version: 2 });
    expect(component['profileForm'][firstId]().value()).toBe('collaborator');
    expect(component['hasUnsavedChanges']()).toBe(true);
  });

  it('refreshes cancelled invitations without changing member drafts', async () => {
    const { fixture, component, edit, member } = await setup();
    edit(firstId);
    edit(secondId);
    await component['cancel'](invitationId);
    await fixture.whenStable();
    expect(component['data']().invitations[0]?.cancelledAt).toBe(42);
    expect(component['profileForm']().value()).toEqual({
      [firstId]: 'collaborator',
      [secondId]: 'collaborator',
    });
    expect(member(firstId).version).toBe(1);
    expect(component['hasUnsavedChanges']()).toBe(true);
  });

  it('guards confirmation and discards drafts only after an accepted, successful reload', async () => {
    const { fixture, component, api, confirmation, edit } = await setup();
    edit(firstId);
    const response = Promise.withResolvers<boolean>();
    confirmation.request.mockReturnValueOnce(response.promise);
    const reload = component['reload']();
    await fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(component['profileForm']().disabled()).toBe(true);
    expect(await component.canDeactivate()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await component['reload']();
    await component['cancel'](invitationId);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.cancel).not.toHaveBeenCalled();
    response.resolve(false);
    await reload;
    expect(component['profileForm'][firstId]().value()).toBe('collaborator');

    api.list.mockRejectedValueOnce(new Error('offline'));
    await component['reload']();
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(component['loading']()).toBe(false);
    expect(component['busy']()).toBe(false);
    await component['reload']();
    expect(component['profileForm'][firstId]().value()).toBe('accountant');
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(true);
  });

  it('retains drafts and versions when reading the saved member fails', async () => {
    const { component, api, edit, member } = await setup();
    edit(firstId);
    edit(secondId);
    api.list.mockRejectedValueOnce(new Error('offline'));
    await component['applyProfile'](member(firstId));
    expect(component['profileForm']().value()).toEqual({
      [firstId]: 'collaborator',
      [secondId]: 'collaborator',
    });
    expect(member(firstId).version).toBe(1);
    expect(component['saved']()).toBe(false);
    expect(component['busy']()).toBe(false);
  });
});
