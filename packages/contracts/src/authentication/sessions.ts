import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { IsoUtc } from '../temporal.js';
import { AuthenticationRequired, RequestRateLimited, RequestInvalidOrigin } from './contracts.js';

export const AccountSession = Schema.Struct({
  id: Ulid,
  startedAt: IsoUtc,
  renewedAt: IsoUtc,
  expiresAt: IsoUtc,
  current: Schema.Boolean,
});
export const AccountSessionList = Schema.Array(AccountSession);
export type AccountSessionList = typeof AccountSessionList.Type;
export class AccountSessionNotFound extends Schema.TaggedError<AccountSessionNotFound>()(
  'AccountSessionNotFound',
  { code: Schema.Literal('account.session_not_found') },
  { httpApiStatus: 404 },
) {}
export class AccountSessionCurrent extends Schema.TaggedError<AccountSessionCurrent>()(
  'AccountSessionCurrent',
  { code: Schema.Literal('account.session_current') },
  { httpApiStatus: 409 },
) {}
export const AccountSessionFailure = Schema.Union([
  AccountSessionNotFound,
  AccountSessionCurrent,
  AuthenticationRequired,
  RequestRateLimited,
  RequestInvalidOrigin,
]);
