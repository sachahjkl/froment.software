import { Schema } from 'effect';
import { AuthenticationRequired, PermissionDenied } from '../authentication/contracts.js';
import { PositiveSafeInteger } from '../documents/lines.js';
import { Ulid } from '../identifiers.js';
import { IsoUtc } from '../temporal.js';

export const AffairTitleMaximumLength = 160;
export const AffairStatus = Schema.Literals(['open', 'closed']);
export const AffairReference = Schema.String.check(Schema.isPattern(/^AF-\d{4}-\d{6}$/));

export const AffairCreateRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  clientId: Ulid,
  title: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(AffairTitleMaximumLength)),
});

export const AffairUpdateRequest = Schema.Struct({
  expectedVersion: PositiveSafeInteger,
  title: AffairCreateRequest.fields.title,
  status: AffairStatus,
});

export const Affair = Schema.Struct({
  id: Ulid,
  requestId: AffairCreateRequest.fields.requestId,
  reference: AffairReference,
  clientId: Ulid,
  clientDisplayName: Schema.String,
  title: AffairCreateRequest.fields.title,
  status: AffairStatus,
  version: PositiveSafeInteger,
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
  quoteIds: Schema.Array(Ulid),
  orderIds: Schema.Array(Ulid),
  invoiceIds: Schema.Array(Ulid),
});

export const AffairList = Schema.Array(Affair).check(Schema.isMaxLength(10_000));

export class AffairNotFound extends Schema.TaggedError<AffairNotFound>()(
  'AffairNotFound',
  { code: Schema.Literal('affair.not_found') },
  { httpApiStatus: 404 },
) {}

export class AffairConflict extends Schema.TaggedError<AffairConflict>()(
  'AffairConflict',
  { code: Schema.Literal('affair.conflict') },
  { httpApiStatus: 409 },
) {}

export const AffairFailure = Schema.Union([
  AffairNotFound,
  AffairConflict,
  AuthenticationRequired,
  PermissionDenied,
]);
