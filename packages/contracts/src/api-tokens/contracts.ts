import { Schema } from 'effect';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestInvalidOrigin,
  RequestRateLimited,
  RequestTooLarge,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { ApiTokenPermissionCode } from '../permissions.js';

const ApiTokenName = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));

export const ApiTokenSecret = Schema.String.check(
  Schema.isPattern(/^froment_api_v1_[0-7][0-9A-HJKMNP-TV-Z]{25}\.[A-Za-z0-9_-]{43}$/),
);
export type ApiTokenSecret = typeof ApiTokenSecret.Type;

export const ApiToken = Schema.Struct({
  id: Ulid,
  name: ApiTokenName,
  permissions: Schema.UniqueArray(ApiTokenPermissionCode),
  createdAt: Schema.Int,
  expiresAt: Schema.Int,
  lastUsedAt: Schema.NullOr(Schema.Int),
  revokedAt: Schema.NullOr(Schema.Int),
  rateLimitPerMinute: Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(600),
  ),
});
export type ApiToken = typeof ApiToken.Type;

export const ApiTokenList = Schema.Array(ApiToken);
export type ApiTokenList = typeof ApiTokenList.Type;

export const ApiTokenPage = Schema.Struct({
  items: ApiTokenList,
  nextCursor: Schema.NullOr(Ulid),
});
export type ApiTokenPage = typeof ApiTokenPage.Type;

export const ApiTokenListQuery = Schema.Struct({
  cursor: Schema.optionalKey(Ulid),
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(100),
    ),
  ),
});
export type ApiTokenListQuery = typeof ApiTokenListQuery.Type;

export const ApiTokenCreateRequest = Schema.Struct({
  name: ApiTokenName,
  permissions: Schema.UniqueArray(ApiTokenPermissionCode).check(Schema.isMinLength(1)),
  expiresAt: Schema.Int,
  rateLimitPerMinute: Schema.optionalKey(
    Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(600)),
  ),
});
export type ApiTokenCreateRequest = typeof ApiTokenCreateRequest.Type;

export const ApiTokenCreated = Schema.Struct({
  token: ApiToken,
  secret: ApiTokenSecret,
});
export type ApiTokenCreated = typeof ApiTokenCreated.Type;

export class ApiTokenNotFound extends Schema.TaggedError<ApiTokenNotFound>()(
  'ApiTokenNotFound',
  { code: Schema.Literal('api_token.not_found') },
  { httpApiStatus: 404 },
) {}

export class ApiTokenNameConflict extends Schema.TaggedError<ApiTokenNameConflict>()(
  'ApiTokenNameConflict',
  { code: Schema.Literal('api_token.name_conflict') },
  { httpApiStatus: 409 },
) {}

export class ApiTokenInvalidExpiration extends Schema.TaggedError<ApiTokenInvalidExpiration>()(
  'ApiTokenInvalidExpiration',
  { code: Schema.Literal('api_token.invalid_expiration') },
  { httpApiStatus: 422 },
) {}

export class ApiTokenInvalidCursor extends Schema.TaggedError<ApiTokenInvalidCursor>()(
  'ApiTokenInvalidCursor',
  { code: Schema.Literal('api_token.invalid_cursor') },
  { httpApiStatus: 400 },
) {}

export const ApiTokenFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  RequestInvalidOrigin,
  RequestTooLarge,
  ApiTokenNotFound,
  ApiTokenNameConflict,
  ApiTokenInvalidExpiration,
  ApiTokenInvalidCursor,
]);
export type ApiTokenFailure = typeof ApiTokenFailure.Type;
