import { Schema } from 'effect';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { DisplayName, Ulid } from '../identifiers.js';

export const SupplierTaxTreatment = Schema.Literals([
  'france',
  'eu-reverse-charge',
  'non-eu-import',
  'foreign-local-tax',
]);
export type SupplierTaxTreatment = typeof SupplierTaxTreatment.Type;
export const SupplierInput = Schema.Struct({
  displayName: DisplayName.check(Schema.isMaxLength(160)),
  addressLine1: Schema.String.check(Schema.isMaxLength(160)),
  addressLine2: Schema.String.check(Schema.isMaxLength(160)),
  postalCode: Schema.String.check(Schema.isMaxLength(32)),
  city: Schema.String.check(Schema.isMaxLength(120)),
  country: Schema.String.check(Schema.isMaxLength(120)),
  email: Schema.String.check(
    Schema.isMaxLength(254),
    Schema.isPattern(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  ),
  phone: Schema.String.check(
    Schema.isMaxLength(64),
    Schema.isPattern(/^$|^\+?[0-9][0-9 ()\-./]{5,62}$/),
  ),
  registrationNumber: Schema.String.check(Schema.isMaxLength(64)),
  vatNumber: Schema.String.check(Schema.isMaxLength(64)),
  taxTreatment: SupplierTaxTreatment,
  defaultCurrency: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)),
  paymentTermsDays: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 365 })),
  iban: Schema.String.check(
    Schema.isMaxLength(42),
    Schema.isPattern(/^$|^[A-Za-z]{2}[0-9A-Za-z ]{13,40}$/),
  ),
  bic: Schema.String.check(
    Schema.isMaxLength(11),
    Schema.isPattern(/^$|^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/),
  ),
}).annotate({ identifier: 'SupplierInput' });
export type SupplierInput = typeof SupplierInput.Type;

export const SupplierSummary = Schema.Struct({
  id: Ulid,
  ...SupplierInput.fields,
  archived: Schema.Boolean,
  viesValidatedAt: Schema.NullOr(Schema.Int),
  updatedAt: Schema.Int,
}).annotate({ identifier: 'SupplierSummary' });
export type SupplierSummary = typeof SupplierSummary.Type;

export const SupplierList = Schema.Array(SupplierSummary);
export type SupplierList = typeof SupplierList.Type;

export const SupplierCreateRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  ...SupplierInput.fields,
}).annotate({ identifier: 'SupplierCreateRequest' });
export type SupplierCreateRequest = typeof SupplierCreateRequest.Type;

export const SupplierUpdateRequest = Schema.Struct({
  ...SupplierInput.fields,
  expectedUpdatedAt: Schema.Int,
}).annotate({ identifier: 'SupplierUpdateRequest' });
export type SupplierUpdateRequest = typeof SupplierUpdateRequest.Type;

export class SupplierNotFound extends Schema.TaggedError<SupplierNotFound>()('SupplierNotFound', {
  code: Schema.Literal('supplier.not_found'),
}) {}

export class SupplierArchived extends Schema.TaggedError<SupplierArchived>()('SupplierArchived', {
  code: Schema.Literal('supplier.archived'),
}) {}

export class SupplierVersionConflict extends Schema.TaggedError<SupplierVersionConflict>()(
  'SupplierVersionConflict',
  { code: Schema.Literal('supplier.version_conflict') },
) {}

export class SupplierCreationConflict extends Schema.TaggedError<SupplierCreationConflict>()(
  'SupplierCreationConflict',
  { code: Schema.Literal('supplier.creation_conflict') },
) {}
export class SupplierTaxInvalid extends Schema.TaggedError<SupplierTaxInvalid>()(
  'SupplierTaxInvalid',
  { code: Schema.Literals(['supplier.tax_invalid', 'supplier.vies_unavailable']) },
) {}

export const SupplierFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  SupplierNotFound,
  SupplierArchived,
  SupplierVersionConflict,
  SupplierCreationConflict,
  SupplierTaxInvalid,
  RequestRateLimited,
]);
export type SupplierFailure = typeof SupplierFailure.Type;
export type SupplierFailureCode = SupplierFailure['code'];
