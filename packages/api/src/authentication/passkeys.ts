import {
  PasskeyList,
  PasskeyRejected,
  PasskeyRegistrationOptions,
  PasskeyLoginOptions,
  PasskeyRegistrationRequest,
  PasskeyRegistrationResponse,
  PasskeyLoginResponse,
  Ulid,
} from '@froment/contracts';
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { Authentication, type AuthenticatedSession, type Principal } from './authentication.js';
import { AuthenticationConfig } from './authentication-config.js';
import { Passwords } from './password.js';

type Failure = PasskeyRejected | DatabaseError;
type Prepared<Options> = { readonly id: string; readonly options: Options };
export class Passkeys extends Context.Service<
  Passkeys,
  {
    readonly list: (principal: Principal) => Effect.Effect<typeof PasskeyList.Type, Failure>;
    readonly registerOptions: (
      principal: Principal,
      request: typeof PasskeyRegistrationRequest.Type,
    ) => Effect.Effect<Prepared<typeof PasskeyRegistrationOptions.Type>, Failure>;
    readonly register: (
      principal: Principal,
      id: string,
      response: typeof PasskeyRegistrationResponse.Type,
    ) => Effect.Effect<void, Failure>;
    readonly remove: (
      principal: Principal,
      id: string,
      password: string,
    ) => Effect.Effect<void, Failure>;
    readonly loginOptions: Effect.Effect<Prepared<typeof PasskeyLoginOptions.Type>, Failure>;
    readonly login: (
      id: string,
      response: typeof PasskeyLoginResponse.Type,
    ) => Effect.Effect<AuthenticatedSession, Failure>;
  }
>()('@froment/api/Passkeys') {}

const Challenge = Schema.Struct({
  challenge: Schema.String,
  userId: Schema.NullOr(Schema.String),
  sessionId: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
});
const StoredCredential = Schema.Struct({
  id: Schema.String,
  userId: Ulid,
  credentialId: Schema.String,
  publicKey: Schema.Uint8Array,
  counter: Schema.Int,
  mode: Schema.Literals(['administrator', 'client']),
});
const reject = () => new PasskeyRejected({ code: 'passkey.rejected' });
const databaseOperation = <A>(operation: string, run: () => A) =>
  Effect.try({
    try: run,
    catch: (cause) =>
      cause instanceof PasskeyRejected ? cause : new DatabaseError({ operation, cause }),
  });
// oxlint-disable-next-line anti-slop/no-natural-language-literals -- SQL predicate, not interface prose.
const activeUser = `users.disabled_at is null and (users.kind <> 'client' or exists (
  select 1 from client_access_accounts join users as client on client.id = client_access_accounts.client_id
  where client_access_accounts.user_id = users.id and client.disabled_at is null))`;

export const PasskeysLive = Layer.effect(
  Passkeys,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const config = yield* AuthenticationConfig;
    const authentication = yield* Authentication;
    const passwords = yield* Passwords;
    const audit = yield* Audit;
    const rpID = new URL(config.publicOrigin).hostname;
    const list = Effect.fn('Passkeys.list')(function* (principal: Principal) {
      return yield* databaseOperation('passkey.list', () =>
        Schema.decodeUnknownSync(PasskeyList)(
          sqlite
            .prepare(
              'select id, name, created_at as createdAt, last_used_at as lastUsedAt from passkeys where user_id = ? order by created_at, id',
            )
            .all(principal.userId),
        ),
      );
    });
    const checkPassword = Effect.fn('Passkeys.checkPassword')(function* (
      principal: Principal,
      password: string,
    ) {
      const hash = yield* databaseOperation('passkey.password', () =>
        Schema.decodeUnknownSync(Schema.String)(
          sqlite
            .prepare('select password_hash from password_credentials where user_id = ?')
            .pluck()
            .get(principal.userId),
        ),
      );
      if (!(yield* passwords.verify(hash, password))) return yield* reject();
    });
    const checkSession = (principal: Principal, now: number) => {
      if (
        sqlite
          .prepare(`select 1 from refresh_sessions join users on users.id = refresh_sessions.user_id
      where refresh_sessions.id = ? and user_id = ? and revoked_at is null and consumed_at is null
      and absolute_expires_at > ? and ${activeUser}`)
          .get(principal.sessionId, principal.userId, now) === undefined
      )
        throw reject();
    };
    const saveChallenge = Effect.fn('Passkeys.saveChallenge')(function* (
      challenge: string,
      principal?: Principal,
      name?: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const id = randomBytes(32).toString('base64url');
      yield* databaseOperation('passkey.challenge.create', () =>
        sqlite
          .transaction(() => {
            sqlite.prepare('delete from passkey_challenges where expires_at <= ?').run(now);
            let kind = 'login';
            if (principal !== undefined) {
              kind = 'registration';
              checkSession(principal, now);
              sqlite
                .prepare('delete from passkey_challenges where session_id = ?')
                .run(principal.sessionId);
            }
            sqlite
              .prepare(
                'insert into passkey_challenges (id, challenge, kind, user_id, session_id, name, expires_at) values (?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                id,
                challenge,
                kind,
                principal?.userId ?? null,
                principal?.sessionId ?? null,
                name ?? null,
                now + 300000,
              );
          })
          .immediate(),
      );
      return id;
    });
    const consume = Effect.fn('Passkeys.consume')(function* (
      id: string,
      kind: 'registration' | 'login',
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* databaseOperation('passkey.challenge.consume', () => {
        const row = sqlite
          .prepare(`delete from passkey_challenges where id = ? and kind = ? and expires_at > ?
        returning challenge, user_id as userId, session_id as sessionId, name`)
          .get(id, kind, now);
        if (row === undefined) throw reject();
        return Schema.decodeUnknownSync(Challenge)(row);
      });
    });
    const registerOptions = Effect.fn('Passkeys.registerOptions')(function* (
      principal: Principal,
      request: typeof PasskeyRegistrationRequest.Type,
    ) {
      yield* checkPassword(principal, request.password);
      const credentials = yield* databaseOperation('passkey.credentials', () =>
        Schema.decodeUnknownSync(Schema.Array(Schema.String))(
          sqlite
            .prepare('select credential_id from passkeys where user_id = ?')
            .pluck()
            .all(principal.userId),
        ),
      );
      if (credentials.length >= 10) return yield* reject();
      const options = yield* Effect.tryPromise({
        try: () =>
          generateRegistrationOptions({
            // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Registered product name.
            rpName: 'Froment Software',
            rpID,
            userName: principal.email,
            userID: new TextEncoder().encode(principal.userId),
            timeout: 60000,
            attestationType: 'none',
            excludeCredentials: credentials.map((id) => ({ id })),
            authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          }),
        catch: reject,
      });
      const id = yield* saveChallenge(options.challenge, principal, request.name.trim());
      return {
        id,
        options: yield* Schema.decodeUnknownEffect(PasskeyRegistrationOptions)(options).pipe(
          Effect.orDie,
        ),
      };
    });
    const register = Effect.fn('Passkeys.register')(function* (
      principal: Principal,
      id: string,
      response: typeof PasskeyRegistrationResponse.Type,
    ) {
      const challenge = yield* consume(id, 'registration');
      if (
        challenge.userId !== principal.userId ||
        challenge.sessionId !== principal.sessionId ||
        challenge.name === null
      )
        return yield* reject();
      const result = yield* Effect.tryPromise({
        try: () =>
          verifyRegistrationResponse({
            response: {
              ...response,
              response: {
                ...response.response,
                transports: [...(response.response.transports ?? [])],
              },
            },
            expectedChallenge: challenge.challenge,
            expectedOrigin: config.publicOrigin,
            expectedRPID: rpID,
            requireUserVerification: true,
          }),
        catch: reject,
      });
      if (!result.verified || result.registrationInfo === undefined) return yield* reject();
      const { credential } = result.registrationInfo;
      const now = yield* Clock.currentTimeMillis;
      yield* databaseOperation('passkey.register', () =>
        sqlite
          .transaction(() => {
            checkSession(principal, now);
            const count = Schema.decodeUnknownSync(Schema.Int)(
              sqlite
                .prepare('select count(*) from passkeys where user_id = ?')
                .pluck()
                .get(principal.userId),
            );
            if (
              count >= 10 ||
              sqlite
                .prepare('select 1 from passkeys where credential_id = ?')
                .get(credential.id) !== undefined
            )
              throw reject();
            const keyId = ulid(now);
            sqlite
              .prepare(
                'insert into passkeys (id, user_id, credential_id, public_key, counter, name, created_at) values (?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                keyId,
                principal.userId,
                credential.id,
                Buffer.from(credential.publicKey),
                credential.counter,
                challenge.name,
                now,
              );
            audit.insert({
              action: 'authentication.passkey-added',
              actorUserId: Schema.decodeUnknownSync(Ulid)(principal.userId),
              resourceType: 'user',
              resourceId: keyId,
              occurredAt: now,
            });
          })
          .immediate(),
      );
    });
    const remove = Effect.fn('Passkeys.remove')(function* (
      principal: Principal,
      id: string,
      password: string,
    ) {
      yield* checkPassword(principal, password);
      const now = yield* Clock.currentTimeMillis;
      yield* databaseOperation('passkey.remove', () =>
        sqlite
          .transaction(() => {
            checkSession(principal, now);
            if (
              sqlite
                .prepare('delete from passkeys where id = ? and user_id = ?')
                .run(id, principal.userId).changes !== 1
            )
              throw reject();
            sqlite
              .prepare(
                'update refresh_sessions set revoked_at = ? where user_id = ? and revoked_at is null and id <> ?',
              )
              .run(now, principal.userId, principal.sessionId);
            sqlite
              .prepare('delete from passkey_challenges where user_id = ?')
              .run(principal.userId);
            audit.insert({
              action: 'authentication.passkey-removed',
              actorUserId: Schema.decodeUnknownSync(Ulid)(principal.userId),
              resourceType: 'user',
              resourceId: id,
              occurredAt: now,
            });
          })
          .immediate(),
      );
    });
    const loginOptions = Effect.gen(function* () {
      const options = yield* Effect.tryPromise({
        try: () =>
          generateAuthenticationOptions({ rpID, userVerification: 'required', timeout: 60000 }),
        catch: reject,
      });
      const id = yield* saveChallenge(options.challenge);
      return {
        id,
        options: yield* Schema.decodeUnknownEffect(PasskeyLoginOptions)(options).pipe(Effect.orDie),
      };
    });
    const login = Effect.fn('Passkeys.login')(function* (
      id: string,
      response: typeof PasskeyLoginResponse.Type,
    ) {
      const challenge = yield* consume(id, 'login');
      const credential = yield* databaseOperation('passkey.lookup', () => {
        const row = sqlite
          .prepare(`select passkeys.id, user_id as userId, credential_id as credentialId, public_key as publicKey, counter, users.kind as mode
        from passkeys join users on users.id = passkeys.user_id where credential_id = ? and ${activeUser}`)
          .get(response.id);
        if (row === undefined) throw reject();
        return Schema.decodeUnknownSync(StoredCredential)(row);
      });
      if (response.response.userHandle !== Buffer.from(credential.userId).toString('base64url'))
        return yield* reject();
      const result = yield* Effect.tryPromise({
        try: () =>
          verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge.challenge,
            expectedOrigin: config.publicOrigin,
            expectedRPID: rpID,
            requireUserVerification: true,
            credential: {
              id: credential.credentialId,
              publicKey: new Uint8Array(credential.publicKey),
              counter: credential.counter,
            },
          }),
        catch: reject,
      });
      if (!result.verified) return yield* reject();
      const now = yield* Clock.currentTimeMillis;
      yield* databaseOperation('passkey.login', () => {
        if (
          sqlite
            .prepare(`update passkeys set counter = ?, last_used_at = ? where id = ? and counter = ?
        and exists (select 1 from users where users.id = passkeys.user_id and ${activeUser})`)
            .run(result.authenticationInfo.newCounter, now, credential.id, credential.counter)
            .changes !== 1
        )
          throw reject();
      });
      const session = yield* authentication.createSession(credential.userId, credential.mode);
      yield* databaseOperation('passkey.login.complete', () =>
        sqlite
          .transaction(() => {
            if (
              sqlite
                .prepare(
                  `select 1 from passkeys join users on users.id = passkeys.user_id where passkeys.id = ? and ${activeUser}`,
                )
                .get(credential.id) === undefined
            ) {
              sqlite
                .prepare('update refresh_sessions set revoked_at = ? where id = ?')
                .run(now, session.sessionId);
              return false;
            }
            audit.insert({
              action: 'authentication.passkey-login',
              actorUserId: credential.userId,
              resourceType: 'session',
              resourceId: session.familyId,
              occurredAt: now,
            });
            return true;
          })
          .immediate(),
      ).pipe(Effect.flatMap((valid) => (valid ? Effect.void : Effect.fail(reject()))));
      return session;
    });
    return Passkeys.of({ list, registerOptions, register, remove, loginOptions, login });
  }),
);
