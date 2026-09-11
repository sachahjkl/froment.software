import type { TranslationKey } from '@froment/l10n';

export type TeamOperation = 'load' | 'invite' | 'cancel' | 'update' | 'join';

export function teamErrorMessage(
  code: TranslationKey | undefined,
  operation: TeamOperation,
): TranslationKey | undefined {
  if (code === 'team.conflict') {
    if (operation === 'cancel') return 'team.cancelRejected';
    if (operation === 'update') return 'team.updateRejected';
    if (operation === 'invite') return 'team.inviteInvalid';
  }
  if (code === 'authentication.permission_denied') {
    if (operation === 'invite') return 'team.invitation_permission';
    if (operation === 'cancel') return 'team.cancelDenied';
    if (operation === 'update') return 'team.updateDenied';
  }
  if (code !== 'team.error') return code;
  const messages = {
    load: 'team.loadError',
    invite: 'team.inviteUnconfirmed',
    cancel: 'team.cancelUnconfirmed',
    update: 'team.updateUnconfirmed',
    join: 'team.joinUnconfirmed',
  } satisfies Record<TeamOperation, TranslationKey>;
  return messages[operation];
}
