import { describe, expect, it } from 'vitest';
import { teamErrorMessage } from './team-error-message';

describe('team error messages', () => {
  it.each([
    ['load', 'team.loadError'],
    ['invite', 'team.inviteUnconfirmed'],
    ['cancel', 'team.cancelUnconfirmed'],
    ['update', 'team.updateUnconfirmed'],
    ['join', 'team.joinUnconfirmed'],
  ] as const)('names the %s operation without claiming a refusal', (operation, message) => {
    expect(teamErrorMessage('team.error', operation)).toBe(message);
    expect(teamErrorMessage('team.invitation_changed', operation)).toBe('team.invitation_changed');
    expect(teamErrorMessage(undefined, operation)).toBeUndefined();
  });

  it('distinguishes invitation cancellation from member access changes', () => {
    expect(teamErrorMessage('team.conflict', 'cancel')).toBe('team.cancelRejected');
    expect(teamErrorMessage('team.conflict', 'update')).toBe('team.updateRejected');
    expect(teamErrorMessage('team.conflict', 'invite')).toBe('team.inviteInvalid');
    expect(teamErrorMessage('authentication.permission_denied', 'invite')).toBe(
      'team.invitation_permission',
    );
    expect(teamErrorMessage('authentication.permission_denied', 'cancel')).toBe(
      'team.cancelDenied',
    );
    expect(teamErrorMessage('authentication.permission_denied', 'update')).toBe(
      'team.updateDenied',
    );
  });
});
