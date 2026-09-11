import { Schema } from 'effect';
import { IssuerSettings } from '../documents/contracts.js';
import { PositiveSafeInteger } from '../documents/lines.js';

export const IssuerSettingsDetail = Schema.Struct({
  ...IssuerSettings.fields,
  version: PositiveSafeInteger,
});
export type IssuerSettingsDetail = typeof IssuerSettingsDetail.Type;

export const IssuerSettingsUpdateRequest = Schema.Struct({
  ...IssuerSettings.fields,
  expectedVersion: PositiveSafeInteger,
});
export type IssuerSettingsUpdateRequest = typeof IssuerSettingsUpdateRequest.Type;

export class IssuerSettingsConflict extends Schema.TaggedError<IssuerSettingsConflict>()(
  'IssuerSettingsConflict',
  { code: Schema.Literal('issuer.conflict') },
  { httpApiStatus: 409 },
) {}
