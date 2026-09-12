import { Schema } from 'effect';
import { AccountEmail, AccountPassword } from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { PermissionCode } from '../permissions.js';

export const TeamProfile = Schema.Literals(['collaborator', 'accountant']);
export const TeamProfilePermissions = {
  accountant: [
    'ledger.read',
    'client.read',
    'quote.read',
    'order.read',
    'invoice.read',
    'payment.read',
    'bank.read',
    'issuer.read',
    'document.download',
    'catalog.read',
    'condition.read',
    'supplier.read',
    'supplier.create',
    'supplier.update',
    'supplier.archive',
  ],
  collaborator: [
    'client.read',
    'client.create',
    'client.update',
    'quote.read',
    'quote.create',
    'quote.update',
    'quote.send',
    'order.read',
    'invoice.read',
    'invoice.create',
    'invoice.update',
    'invoice.issue',
    'payment.read',
    'invoice.mark-paid',
    'bank.read',
    'bank.import',
    'bank.reconcile',
    'catalog.read',
    'condition.read',
    'issuer.read',
    'document.download',
    'email.draft.manage',
    'document.render',
    'integration.manage',
    'supplier.read',
  ],
} as const satisfies Record<typeof TeamProfile.Type, ReadonlyArray<typeof PermissionCode.Type>>;
export const TeamInvitationId = Schema.String.check(Schema.isUUID(4));
export const TeamInvite = Schema.Struct({
  requestId: TeamInvitationId,
  email: AccountEmail,
  displayName: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  profile: TeamProfile,
});
export const TeamInvitation = Schema.Struct({
  id: TeamInvitationId,
  email: AccountEmail,
  displayName: TeamInvite.fields.displayName,
  profile: TeamProfile,
  createdAt: Schema.Int,
  expiresAt: Schema.Int,
  cancelledAt: Schema.NullOr(Schema.Int),
  acceptedAt: Schema.NullOr(Schema.Int),
});
export const TeamInviteResult = Schema.Struct({ invitation: TeamInvitation, url: Schema.String });
export const TeamAccept = Schema.Struct({
  token: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
  password: AccountPassword,
});
export const TeamMember = Schema.Struct({
  id: Ulid,
  email: AccountEmail,
  displayName: TeamInvite.fields.displayName,
  profile: TeamProfile,
  version: Schema.Int,
  disabledAt: Schema.NullOr(Schema.Int),
});
export const TeamMemberUpdate = Schema.Struct({
  expectedVersion: Schema.Int.check(Schema.isGreaterThan(0)),
  profile: TeamProfile,
  disabled: Schema.Boolean,
});
export const TeamList = Schema.Struct({
  members: Schema.Array(TeamMember),
  invitations: Schema.Array(TeamInvitation),
});
export class TeamConflict extends Schema.TaggedError<TeamConflict>()(
  'TeamConflict',
  {
    code: Schema.Literals([
      'team.conflict',
      'team.email_exists',
      'team.invitation_exists',
      'team.invitation_limit',
      'team.invitation_changed',
      'team.invitation_inactive',
      'team.invitation_permission',
    ]),
  },
  { httpApiStatus: 409 },
) {}
export class TeamInvitationRejected extends Schema.TaggedError<TeamInvitationRejected>()(
  'TeamInvitationRejected',
  { code: Schema.Literal('team.invitation_rejected') },
  { httpApiStatus: 409 },
) {}
export const TeamFailure = Schema.Union([TeamConflict, TeamInvitationRejected]);
