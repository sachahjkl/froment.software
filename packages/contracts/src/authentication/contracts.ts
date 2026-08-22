import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';

export const AccountEmail = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
);
export type AccountEmail = typeof AccountEmail.Type;

export const AccountPassword = Schema.String.check(Schema.isMinLength(12), Schema.isMaxLength(256));
export type AccountPassword = typeof AccountPassword.Type;

export const LoginMode = Schema.Literals(['client', 'administrator']);
export type LoginMode = typeof LoginMode.Type;

export const LoginRequest = Schema.Struct({
  email: AccountEmail,
  password: AccountPassword,
});
export type LoginRequest = typeof LoginRequest.Type;

export const BrowserSession = Schema.Struct({
  expiresAt: Schema.Int,
  mode: LoginMode,
});
export type BrowserSession = typeof BrowserSession.Type;

export const CurrentAccount = Schema.Struct({
  userId: Ulid,
  mode: LoginMode,
});
export type CurrentAccount = typeof CurrentAccount.Type;

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

export class RequestInvalidOrigin extends Schema.TaggedError<RequestInvalidOrigin>()(
  'RequestInvalidOrigin',
  { code: Schema.Literal('request.invalid_origin') },
  { httpApiStatus: 403 },
) {}

export class RequestTooLarge extends Schema.TaggedError<RequestTooLarge>()(
  'RequestTooLarge',
  { code: Schema.Literal('request.too_large') },
  { httpApiStatus: 413 },
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

export const AuthenticationFailure = Schema.Union([
  AuthenticationRejected,
  AuthenticationRateLimited,
]);
export type AuthenticationFailure = typeof AuthenticationFailure.Type;
export type AuthenticationFailureCode = AuthenticationFailure['code'];
