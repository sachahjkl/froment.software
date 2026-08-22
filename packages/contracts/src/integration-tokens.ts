import { Schema } from 'effect';

import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from './authentication.js';
import { Ulid } from './identifiers.js';
import { IntegrationPermissionCode } from './permissions.js';

const IntegrationTokenName = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));

export const IntegrationTokenSecret = Schema.String.check(
  Schema.isPattern(/^froment_it_v1_[0-7][0-9A-HJKMNP-TV-Z]{25}\.[A-Za-z0-9_-]{43}$/),
);
export type IntegrationTokenSecret = typeof IntegrationTokenSecret.Type;

export const IntegrationToken = Schema.Struct({
  id: Ulid,
  name: IntegrationTokenName,
  permissions: Schema.UniqueArray(IntegrationPermissionCode),
  createdAt: Schema.Int,
  expiresAt: Schema.Int,
  lastUsedAt: Schema.NullOr(Schema.Int),
  revokedAt: Schema.NullOr(Schema.Int),
  rateLimitPerMinute: Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(600),
  ),
});
export type IntegrationToken = typeof IntegrationToken.Type;

export const IntegrationTokenList = Schema.Array(IntegrationToken);
export type IntegrationTokenList = typeof IntegrationTokenList.Type;

export const IntegrationTokenPage = Schema.Struct({
  items: IntegrationTokenList,
  nextCursor: Schema.NullOr(Ulid),
});
export type IntegrationTokenPage = typeof IntegrationTokenPage.Type;

export const IntegrationTokenListQuery = Schema.Struct({
  cursor: Schema.optionalKey(Ulid),
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(100),
    ),
  ),
});
export type IntegrationTokenListQuery = typeof IntegrationTokenListQuery.Type;

export const IntegrationTokenCreateRequest = Schema.Struct({
  name: IntegrationTokenName,
  permissions: Schema.UniqueArray(IntegrationPermissionCode).check(Schema.isMinLength(1)),
  expiresAt: Schema.Int,
  rateLimitPerMinute: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(600)),
  ),
});
export type IntegrationTokenCreateRequest = typeof IntegrationTokenCreateRequest.Type;

export const IntegrationTokenCreated = Schema.Struct({
  token: IntegrationToken,
  secret: IntegrationTokenSecret,
});
export type IntegrationTokenCreated = typeof IntegrationTokenCreated.Type;

export class IntegrationTokenNotFound extends Schema.TaggedError<IntegrationTokenNotFound>()(
  'IntegrationTokenNotFound',
  { code: Schema.Literal('integration_token.not_found') },
  { httpApiStatus: 404 },
) {}

export class IntegrationTokenNameConflict extends Schema.TaggedError<IntegrationTokenNameConflict>()(
  'IntegrationTokenNameConflict',
  { code: Schema.Literal('integration_token.name_conflict') },
  { httpApiStatus: 409 },
) {}

export class IntegrationTokenInvalidExpiration extends Schema.TaggedError<IntegrationTokenInvalidExpiration>()(
  'IntegrationTokenInvalidExpiration',
  { code: Schema.Literal('integration_token.invalid_expiration') },
  { httpApiStatus: 422 },
) {}

export const IntegrationTokenFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  CsrfRejected,
  RequestRateLimited,
  IntegrationTokenNotFound,
  IntegrationTokenNameConflict,
  IntegrationTokenInvalidExpiration,
]);
export type IntegrationTokenFailure = typeof IntegrationTokenFailure.Type;
