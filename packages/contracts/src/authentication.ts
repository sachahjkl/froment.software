import { Schema } from 'effect';

export const AccessIdentifier = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));
export type AccessIdentifier = typeof AccessIdentifier.Type;

export const LoginRequest = Schema.Struct({
  accessIdentifier: AccessIdentifier,
});
export type LoginRequest = typeof LoginRequest.Type;

export const SessionStatus = Schema.Struct({
  authenticated: Schema.Boolean,
});
export type SessionStatus = typeof SessionStatus.Type;

export class AuthenticationRejected extends Schema.TaggedError<AuthenticationRejected>()(
  'AuthenticationRejected',
  { code: Schema.Literal('authentication.invalid_credentials') },
  { httpApiStatus: 401 },
) {}

export class SessionRejected extends Schema.TaggedError<SessionRejected>()(
  'SessionRejected',
  { code: Schema.Literal('authentication.invalid_session') },
  { httpApiStatus: 401 },
) {}

export class AuthenticationRateLimited extends Schema.TaggedError<AuthenticationRateLimited>()(
  'AuthenticationRateLimited',
  { code: Schema.Literal('authentication.rate_limited') },
  { httpApiStatus: 429 },
) {}

export const AuthenticationFailure = Schema.Union([
  AuthenticationRejected,
  AuthenticationRateLimited,
]);
export type AuthenticationFailure = typeof AuthenticationFailure.Type;
export type AuthenticationFailureCode = AuthenticationFailure['code'];
