import { Schema } from 'effect';

import {
  AccessIdentifier,
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from './authentication.js';
import { Ulid } from './identifiers.js';

export const ClientSummary = Schema.Struct({
  id: Ulid,
  displayName: Schema.NonEmptyString,
  addressLine1: Schema.String,
  addressLine2: Schema.String,
  postalCode: Schema.String,
  city: Schema.String,
  country: Schema.String,
  email: Schema.String,
  archived: Schema.Boolean,
  updatedAt: Schema.Int,
});
export type ClientSummary = typeof ClientSummary.Type;

export const ClientList = Schema.Array(ClientSummary);
export type ClientList = typeof ClientList.Type;

export const ClientCreateRequest = Schema.Struct({
  displayName: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  addressLine1: Schema.String.check(Schema.isMaxLength(160)),
  addressLine2: Schema.String.check(Schema.isMaxLength(160)),
  postalCode: Schema.String.check(Schema.isMaxLength(32)),
  city: Schema.String.check(Schema.isMaxLength(120)),
  country: Schema.String.check(Schema.isMaxLength(120)),
  email: Schema.String.check(
    Schema.isMaxLength(254),
    Schema.isPattern(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  ),
});
export type ClientCreateRequest = typeof ClientCreateRequest.Type;

export const ClientUpdateRequest = Schema.Struct({
  ...ClientCreateRequest.fields,
  expectedUpdatedAt: Schema.Int,
});
export type ClientUpdateRequest = typeof ClientUpdateRequest.Type;

export const ClientAccess = Schema.Struct({
  clientId: Ulid,
  accessIdentifier: AccessIdentifier,
});
export type ClientAccess = typeof ClientAccess.Type;

export class ClientNotFound extends Schema.TaggedError<ClientNotFound>()(
  'ClientNotFound',
  { code: Schema.Literal('client.not_found') },
  { httpApiStatus: 404 },
) {}

export class ClientArchived extends Schema.TaggedError<ClientArchived>()(
  'ClientArchived',
  { code: Schema.Literal('client.archived') },
  { httpApiStatus: 409 },
) {}

export class ClientVersionConflict extends Schema.TaggedError<ClientVersionConflict>()(
  'ClientVersionConflict',
  { code: Schema.Literal('client.version_conflict') },
  { httpApiStatus: 409 },
) {}

export const ClientFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  CsrfRejected,
  ClientNotFound,
  ClientArchived,
  ClientVersionConflict,
  RequestRateLimited,
]);
export type ClientFailure = typeof ClientFailure.Type;
export type ClientFailureCode = ClientFailure['code'];
