import {
  TeamAccept,
  TeamConflict,
  TeamInvitation,
  TeamInvitationRejected,
  TeamInvite,
  TeamList,
  TeamMemberUpdate,
  TeamProfile,
  TeamProfilePermissions,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { createHash, createHmac } from 'node:crypto';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { Passwords } from '../authentication/password.js';
import { AuthenticationConfig } from '../authentication/authentication-config.js';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const invitationQuery =
  'select id, email, display_name as displayName, profile, created_at as createdAt, expires_at as expiresAt, cancelled_at as cancelledAt, accepted_at as acceptedAt, created_by_user_id as actor from team_invitations';
const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const passwords = yield* Passwords;
  const config = yield* AuthenticationConfig;
  const conflict = () => new TeamConflict({ code: 'team.conflict' });
  const rejected = () => new TeamInvitationRejected({ code: 'team.invitation_rejected' });
  const allowed = (actor: string, permission: string) =>
    sqlite
      .prepare(
        `select 1 from users u join user_roles ur on ur.user_id = u.id join role_permissions rp on rp.role_id = ur.role_id where u.id = ? and u.disabled_at is null and u.kind = 'administrator' and rp.permission_code = ?`,
      )
      .get(actor, permission) !== undefined;
  const assignProfile = (userId: string, profile: typeof TeamProfile.Type, now: number) => {
    const name = `team-${userId}`;
    const roleId =
      Schema.decodeUnknownSync(Schema.UndefinedOr(Schema.String))(
        sqlite.prepare('select id from roles where name = ?').pluck().get(name),
      ) ?? ulid();
    sqlite
      .prepare('insert or ignore into roles (id, name, created_at) values (?, ?, ?)')
      .run(roleId, name, now);
    sqlite.prepare('delete from user_roles where user_id = ?').run(userId);
    sqlite.prepare('delete from role_permissions where role_id = ?').run(roleId);
    for (const code of TeamProfilePermissions[profile])
      sqlite
        .prepare('insert into role_permissions (role_id, permission_code) values (?, ?)')
        .run(roleId, code);
    sqlite.prepare('insert into user_roles (user_id, role_id) values (?, ?)').run(userId, roleId);
  };
  const list = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(TeamList)({
          members: sqlite
            .prepare(
              'select u.id, p.email, u.display_name as displayName, t.profile, t.version, u.disabled_at as disabledAt from team_members t join users u on u.id = t.user_id join password_credentials p on p.user_id = u.id order by u.created_at desc',
            )
            .all(),
          invitations: sqlite
            .prepare(`${invitationQuery}
          order by (expires_at > ? and accepted_at is null and cancelled_at is null) desc,
          created_at desc, id desc limit 100`)
            .all(now),
        }),
      catch: (cause) => new DatabaseError({ operation: 'team.list', cause }),
    });
  });
  const invite = Effect.fn('Team.invite')(function* (
    actor: string,
    request: typeof TeamInvite.Type,
  ) {
    const now = yield* Clock.currentTimeMillis;
    const email = request.email.trim().toLowerCase();
    const displayName = request.displayName.trim();
    const token = createHmac('sha256', config.quoteLinkHmacKey)
      .update(`team-invitation:${actor}:${request.requestId}`)
      .digest('base64url');
    const invitation = yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (!allowed(actor, 'user.create')) throw conflict();
            const existing = sqlite
              .prepare(`${invitationQuery} where id = ?`)
              .get(request.requestId);
            if (existing !== undefined) {
              const saved = Schema.decodeUnknownSync(
                Schema.Struct({ ...TeamInvitation.fields, actor: Schema.String }),
              )(existing);
              if (
                saved.actor !== actor ||
                saved.email !== email ||
                saved.displayName !== displayName ||
                saved.profile !== request.profile ||
                saved.cancelledAt !== null ||
                saved.acceptedAt !== null ||
                saved.expiresAt <= now
              )
                throw conflict();
              return saved;
            }
            if (
              sqlite.prepare('select 1 from password_credentials where email = ?').get(email) !==
                undefined ||
              sqlite
                .prepare(
                  'select 1 from team_invitations where email = ? and expires_at > ? and accepted_at is null and cancelled_at is null',
                )
                .get(email, now) !== undefined
            )
              throw conflict();
            const count = Schema.decodeUnknownSync(Schema.Int)(
              sqlite
                .prepare(
                  'select count(*) from team_invitations where expires_at > ? and accepted_at is null and cancelled_at is null',
                )
                .pluck()
                .get(now),
            );
            if (count >= 100) throw conflict();
            const value = {
              id: request.requestId,
              email,
              displayName,
              profile: request.profile,
              createdAt: now,
              expiresAt: now + 7 * 86400000,
              acceptedAt: null,
              cancelledAt: null,
            };
            sqlite
              .prepare(
                'insert into team_invitations (id, email, display_name, profile, token_hash, created_by_user_id, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                value.id,
                email,
                displayName,
                request.profile,
                digest(token),
                actor,
                now,
                value.expiresAt,
              );
            audit.insert({
              action: 'team.invited',
              actorUserId: actor,
              resourceType: 'team-invitation',
              resourceId: value.id,
              occurredAt: now,
              metadata: { profile: request.profile },
            });
            return value;
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof TeamConflict
          ? cause
          : new DatabaseError({ operation: 'team.invite', cause }),
    });
    return { invitation, url: `${config.publicOrigin}/backoffice/join#${token}` };
  });
  const cancel = Effect.fn('Team.cancel')(function* (actor: string, id: string) {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (!allowed(actor, 'user.create')) throw conflict();
            const row = sqlite.prepare(`${invitationQuery} where id = ?`).get(id);
            if (row === undefined) throw conflict();
            const invitation = Schema.decodeUnknownSync(TeamInvitation)(row);
            if (invitation.acceptedAt !== null) throw conflict();
            if (invitation.cancelledAt !== null) return;
            sqlite
              .prepare('update team_invitations set cancelled_at = ? where id = ?')
              .run(now, id);
            audit.insert({
              action: 'team.invitation-cancelled',
              actorUserId: actor,
              resourceType: 'team-invitation',
              resourceId: id,
              occurredAt: now,
            });
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof TeamConflict
          ? cause
          : new DatabaseError({ operation: 'team.cancel', cause }),
    });
  });
  const accept = Effect.fn('Team.accept')(function* (request: typeof TeamAccept.Type) {
    const hash = digest(request.token);
    const now = yield* Clock.currentTimeMillis;
    const exists = yield* Effect.try({
      try: () =>
        sqlite
          .prepare(
            'select 1 from team_invitations where token_hash = ? and expires_at > ? and cancelled_at is null and accepted_at is null',
          )
          .get(hash, now) !== undefined,
      catch: (cause) => new DatabaseError({ operation: 'team.check', cause }),
    });
    if (!exists) return yield* rejected();
    const passwordHash = yield* passwords.hash(request.password).pipe(Effect.orDie);
    const acceptedAt = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            const row = sqlite.prepare(`${invitationQuery} where token_hash = ?`).get(hash);
            if (row === undefined) throw rejected();
            const invitation = Schema.decodeUnknownSync(
              Schema.Struct({ ...TeamInvitation.fields, actor: Schema.String }),
            )(row);
            if (
              invitation.expiresAt <= acceptedAt ||
              invitation.acceptedAt !== null ||
              invitation.cancelledAt !== null ||
              !allowed(invitation.actor, 'user.create')
            )
              throw rejected();
            if (
              sqlite
                .prepare('select 1 from password_credentials where email = ?')
                .get(invitation.email) !== undefined
            )
              throw rejected();
            if (
              Schema.decodeUnknownSync(Schema.Int)(
                sqlite.prepare('select count(*) from team_members').pluck().get(),
              ) >= 100
            )
              throw rejected();
            const id = ulid();
            sqlite
              .prepare(
                "insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, 'administrator', ?, ?)",
              )
              .run(id, invitation.displayName, acceptedAt, acceptedAt);
            sqlite
              .prepare(
                'insert into password_credentials (user_id, email, password_hash, created_at, updated_at, password_changed_at) values (?, ?, ?, ?, ?, ?)',
              )
              .run(id, invitation.email, passwordHash, acceptedAt, acceptedAt, acceptedAt);
            sqlite
              .prepare('insert into team_members (user_id, profile, version) values (?, ?, 1)')
              .run(id, invitation.profile);
            assignProfile(id, invitation.profile, acceptedAt);
            sqlite
              .prepare('update team_invitations set accepted_at = ? where id = ?')
              .run(acceptedAt, invitation.id);
            audit.insert({
              action: 'team.joined',
              actorUserId: id,
              resourceType: 'team-invitation',
              resourceId: invitation.id,
              occurredAt: acceptedAt,
              metadata: { profile: invitation.profile },
            });
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof TeamInvitationRejected
          ? cause
          : new DatabaseError({ operation: 'team.accept', cause }),
    });
  });
  const update = Effect.fn('Team.update')(function* (
    actor: string,
    id: string,
    request: typeof TeamMemberUpdate.Type,
  ) {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (actor === id || !allowed(actor, 'user.update')) throw conflict();
            const row = sqlite
              .prepare(
                'select t.version, t.profile, u.disabled_at as disabledAt from team_members t join users u on u.id = t.user_id where t.user_id = ?',
              )
              .get(id);
            if (row === undefined) throw conflict();
            const member = Schema.decodeUnknownSync(
              Schema.Struct({
                version: Schema.Int,
                profile: TeamProfile,
                disabledAt: Schema.NullOr(Schema.Int),
              }),
            )(row);
            if (member.version !== request.expectedVersion) {
              if (
                member.version === request.expectedVersion + 1 &&
                member.profile === request.profile &&
                (member.disabledAt !== null) === request.disabled
              )
                return;
              throw conflict();
            }
            assignProfile(id, request.profile, now);
            sqlite
              .prepare(
                'update team_members set profile = ?, version = version + 1 where user_id = ?',
              )
              .run(request.profile, id);
            sqlite
              .prepare('update users set disabled_at = ?, updated_at = ? where id = ?')
              .run(request.disabled ? now : null, now, id);
            sqlite
              .prepare(
                'update refresh_sessions set revoked_at = ? where user_id = ? and revoked_at is null',
              )
              .run(now, id);
            sqlite
              .prepare(
                'update api_tokens set revoked_at = ?, revoked_by_user_id = ? where user_id = ? and revoked_at is null',
              )
              .run(now, actor, id);
            sqlite.prepare('delete from passkey_challenges where user_id = ?').run(id);
            audit.insert({
              action: 'team.member-updated',
              actorUserId: actor,
              resourceType: 'user',
              resourceId: id,
              occurredAt: now,
              metadata: { profile: request.profile, disabled: String(request.disabled) },
            });
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof TeamConflict
          ? cause
          : new DatabaseError({ operation: 'team.update', cause }),
    });
  });
  return { list, invite, cancel, accept, update };
});
export class Team extends Context.Service<Team, Effect.Success<typeof make>>()(
  '@froment/api/Team',
) {}
export const TeamLive = Layer.effect(Team, make);
