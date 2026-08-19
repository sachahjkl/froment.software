import { Schema } from 'effect';

import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from './authentication.js';
import { ClientArchived, ClientNotFound } from './clients.js';
import { Ulid } from './identifiers.js';

const SafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
const PositiveSafeInteger = SafeInteger.check(Schema.isGreaterThan(0));
const IsoUtc = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
);

export const QuoteStatus = Schema.Literals(['draft', 'sent', 'accepted', 'rejected', 'expired']);
export type QuoteStatus = typeof QuoteStatus.Type;

export const QuoteLineInput = Schema.Struct({
  description: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  quantityMilli: PositiveSafeInteger,
  unitPriceCents: SafeInteger,
  vatRateBasisPoints: SafeInteger.check(Schema.isLessThanOrEqualTo(10_000)),
});
export type QuoteLineInput = typeof QuoteLineInput.Type;

const QuoteLinesInput = Schema.Array(QuoteLineInput).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(20),
);
const QuoteTitle = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));
const QuoteConditions = Schema.String.check(Schema.isMaxLength(2_000));

export const QuoteCreateRequest = Schema.Struct({
  clientId: Ulid,
  title: QuoteTitle,
  conditions: QuoteConditions,
  lines: QuoteLinesInput,
});
export type QuoteCreateRequest = typeof QuoteCreateRequest.Type;

export const QuoteRevisionCreateRequest = Schema.Struct({
  expectedVersion: PositiveSafeInteger,
  title: QuoteTitle,
  conditions: QuoteConditions,
  lines: QuoteLinesInput,
});
export type QuoteRevisionCreateRequest = typeof QuoteRevisionCreateRequest.Type;

export const QuoteLine = Schema.Struct({
  id: Ulid,
  position: SafeInteger,
  ...QuoteLineInput.fields,
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
});
export type QuoteLine = typeof QuoteLine.Type;

export const QuoteRevision = Schema.Struct({
  id: Ulid,
  version: PositiveSafeInteger,
  clientDisplayName: Schema.NonEmptyString,
  title: QuoteTitle,
  conditions: QuoteConditions,
  currency: Schema.Literal('EUR'),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  createdByUserId: Ulid,
  lines: Schema.Array(QuoteLine),
});
export type QuoteRevision = typeof QuoteRevision.Type;

export const QuoteSummary = Schema.Struct({
  id: Ulid,
  clientId: Ulid,
  status: QuoteStatus,
  version: PositiveSafeInteger,
  currentRevision: QuoteRevision,
});
export type QuoteSummary = typeof QuoteSummary.Type;

export const QuoteDetail = Schema.Struct({
  ...QuoteSummary.fields,
  revisions: Schema.Array(QuoteRevision),
});
export type QuoteDetail = typeof QuoteDetail.Type;

export const QuoteList = Schema.Array(QuoteDetail);
export type QuoteList = typeof QuoteList.Type;

export class QuoteNotFound extends Schema.TaggedError<QuoteNotFound>()(
  'QuoteNotFound',
  { code: Schema.Literal('quote.not_found') },
  { httpApiStatus: 404 },
) {}

export class QuoteVersionConflict extends Schema.TaggedError<QuoteVersionConflict>()(
  'QuoteVersionConflict',
  {
    code: Schema.Literal('quote.version_conflict'),
    currentVersion: PositiveSafeInteger,
  },
  { httpApiStatus: 409 },
) {}

export class QuoteAmountTooLarge extends Schema.TaggedError<QuoteAmountTooLarge>()(
  'QuoteAmountTooLarge',
  { code: Schema.Literal('quote.amount_too_large') },
  { httpApiStatus: 422 },
) {}

export const QuoteFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  CsrfRejected,
  QuoteNotFound,
  QuoteVersionConflict,
  QuoteAmountTooLarge,
  ClientNotFound,
  ClientArchived,
  RequestRateLimited,
]);
export type QuoteFailure = typeof QuoteFailure.Type;
