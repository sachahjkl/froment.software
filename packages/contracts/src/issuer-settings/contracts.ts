import { Schema } from 'effect';
import { IssuerSettings } from '../documents/contracts.js';
import { PositiveSafeInteger } from '../documents/lines.js';

export const IssuerPaymentAccount = Schema.Struct({
  iban: Schema.String.check(
    Schema.isMaxLength(42),
    Schema.isPattern(/^$|^[A-Za-z]{2}[0-9A-Za-z ]{13,40}$/),
  ),
  bic: Schema.String.check(
    Schema.isMaxLength(11),
    Schema.isPattern(/^$|^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/),
  ),
});
export type IssuerPaymentAccount = typeof IssuerPaymentAccount.Type;

export const IssuerSettingsDetail = Schema.Struct({
  ...IssuerSettings.fields,
  ...IssuerPaymentAccount.fields,
  version: PositiveSafeInteger,
});
export type IssuerSettingsDetail = typeof IssuerSettingsDetail.Type;

export const IssuerSettingsUpdateRequest = Schema.Struct({
  ...IssuerSettings.fields,
  ...IssuerPaymentAccount.fields,
  expectedVersion: PositiveSafeInteger,
});
export type IssuerSettingsUpdateRequest = typeof IssuerSettingsUpdateRequest.Type;

export class IssuerSettingsConflict extends Schema.TaggedError<IssuerSettingsConflict>()(
  'IssuerSettingsConflict',
  { code: Schema.Literal('issuer.conflict') },
  { httpApiStatus: 409 },
) {}
