import { Schema } from 'effect';

export const AccessIdentifier = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));
export type AccessIdentifier = typeof AccessIdentifier.Type;

export const LoginMode = Schema.Literals(['client', 'administrator']);
export type LoginMode = typeof LoginMode.Type;

export const LoginRequest = Schema.Struct({
  accessIdentifier: AccessIdentifier,
});
export type LoginRequest = typeof LoginRequest.Type;

export const SessionStatus = Schema.Union([
  Schema.Struct({ authenticated: Schema.Literal(true), mode: LoginMode }),
  Schema.Struct({ authenticated: Schema.Literal(false), mode: Schema.Null }),
]);
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

export class RequestRateLimited extends Schema.TaggedError<RequestRateLimited>()(
  'RequestRateLimited',
  { code: Schema.Literal('request.rate_limited') },
  { httpApiStatus: 429 },
) {}

export class AuthenticationRequired extends Schema.TaggedError<AuthenticationRequired>()(
  'AuthenticationRequired',
  { code: Schema.Literal('authentication.required') },
  { httpApiStatus: 401 },
) {}

export class PermissionDenied extends Schema.TaggedError<PermissionDenied>()(
  'PermissionDenied',
  { code: Schema.Literal('authentication.permission_denied') },
  { httpApiStatus: 403 },
) {}

export class CsrfRejected extends Schema.TaggedError<CsrfRejected>()(
  'CsrfRejected',
  { code: Schema.Literal('authentication.invalid_csrf') },
  { httpApiStatus: 403 },
) {}

export const AuthenticationFailure = Schema.Union([
  AuthenticationRejected,
  AuthenticationRateLimited,
]);
export type AuthenticationFailure = typeof AuthenticationFailure.Type;
export type AuthenticationFailureCode = AuthenticationFailure['code'];
