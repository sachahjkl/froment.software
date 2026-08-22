import { Schema } from 'effect';

import { AccountEmail, AccountPassword } from '../authentication/contracts.js';
import { BrowserSession } from '../authentication/contracts.js';

export const BootstrapStatus = Schema.Struct({
  available: Schema.Boolean,
});
export interface BootstrapStatus extends Schema.Schema.Type<typeof BootstrapStatus> {}

export const BootstrapRequest = Schema.Struct({
  bootstrapPassword: Schema.NonEmptyString.check(Schema.isMaxLength(256)),
  email: AccountEmail,
  password: AccountPassword,
});
export interface BootstrapRequest extends Schema.Schema.Type<typeof BootstrapRequest> {}

export const BootstrapResult = BrowserSession;
export interface BootstrapResult extends Schema.Schema.Type<typeof BootstrapResult> {}

export class BootstrapRejected extends Schema.TaggedError<BootstrapRejected>()(
  'BootstrapRejected',
  { code: Schema.Literal('bootstrap.invalid_credentials') },
  { httpApiStatus: 401 },
) {}

export class BootstrapUnavailable extends Schema.TaggedError<BootstrapUnavailable>()(
  'BootstrapUnavailable',
  { code: Schema.Literal('bootstrap.unavailable') },
  { httpApiStatus: 409 },
) {}

export class BootstrapRateLimited extends Schema.TaggedError<BootstrapRateLimited>()(
  'BootstrapRateLimited',
  { code: Schema.Literal('bootstrap.rate_limited') },
  { httpApiStatus: 429 },
) {}

export const BootstrapFailure = Schema.Union([
  BootstrapRejected,
  BootstrapUnavailable,
  BootstrapRateLimited,
]);
export type BootstrapFailure = typeof BootstrapFailure.Type;
export type BootstrapFailureCode = BootstrapFailure['code'];
