import { Schema } from 'effect';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { DocumentLineInput, PositiveSafeInteger } from '../documents/lines.js';
import { Ulid } from '../identifiers.js';

export const CatalogItemCreateRequest = Schema.Struct({
  ...DocumentLineInput.fields,
  currency: Schema.Literal('EUR'),
});
export type CatalogItemCreateRequest = typeof CatalogItemCreateRequest.Type;
export const CatalogItem = Schema.Struct({
  ...CatalogItemCreateRequest.fields,
  id: Ulid,
  version: PositiveSafeInteger,
  archived: Schema.Boolean,
});
export type CatalogItem = typeof CatalogItem.Type;
export const CatalogItemList = Schema.Array(CatalogItem);
export type CatalogItemList = typeof CatalogItemList.Type;
export const CatalogItemUpdateRequest = Schema.Struct({
  ...CatalogItemCreateRequest.fields,
  expectedVersion: PositiveSafeInteger,
  archived: Schema.Boolean,
});
export type CatalogItemUpdateRequest = typeof CatalogItemUpdateRequest.Type;
export class CatalogItemNotFound extends Schema.TaggedError<CatalogItemNotFound>()(
  'CatalogItemNotFound',
  { code: Schema.Literal('catalog.not_found') },
  { httpApiStatus: 404 },
) {}
export class CatalogItemVersionConflict extends Schema.TaggedError<CatalogItemVersionConflict>()(
  'CatalogItemVersionConflict',
  { code: Schema.Literal('catalog.version_conflict') },
  { httpApiStatus: 409 },
) {}
export const CatalogFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  CatalogItemNotFound,
  CatalogItemVersionConflict,
]);
export type CatalogFailure = typeof CatalogFailure.Type;
