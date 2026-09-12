import { Schema } from 'effect';

import {
  AccountEmail,
  AccountPassword,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { DisplayName, Ulid } from '../identifiers.js';

export const ClientSummary = Schema.Struct({
  id: Ulid,
  displayName: DisplayName,
  addressLine1: Schema.String,
  addressLine2: Schema.String,
  postalCode: Schema.String,
  city: Schema.String,
  country: Schema.String,
  email: Schema.String,
  phone: Schema.String,
  archived: Schema.Boolean,
  updatedAt: Schema.Int,
}).annotate({ identifier: 'ClientSummary' });
export type ClientSummary = typeof ClientSummary.Type;

export const ClientList = Schema.Array(ClientSummary);
export type ClientList = typeof ClientList.Type;

export const ClientInput = Schema.Struct({
  displayName: DisplayName.check(Schema.isMaxLength(120)),
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
});
export type ClientInput = typeof ClientInput.Type;

export const ClientCreateRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  ...ClientInput.fields,
}).annotate({ identifier: 'ClientCreateRequest' });
export type ClientCreateRequest = typeof ClientCreateRequest.Type;

export const ClientUpdateRequest = Schema.Struct({
  ...ClientInput.fields,
  expectedUpdatedAt: Schema.Int,
}).annotate({ identifier: 'ClientUpdateRequest' });
export type ClientUpdateRequest = typeof ClientUpdateRequest.Type;

export const ClientAccess = Schema.Struct({
  id: Ulid,
  clientId: Ulid,
  email: AccountEmail,
  createdAt: Schema.Int,
});
export type ClientAccess = typeof ClientAccess.Type;

export const ClientAccessList = Schema.Array(ClientAccess);
export type ClientAccessList = typeof ClientAccessList.Type;

export const ClientAccessRequest = Schema.Struct({
  email: AccountEmail,
  password: AccountPassword,
});
export type ClientAccessRequest = typeof ClientAccessRequest.Type;

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

export class ClientEmailConflict extends Schema.TaggedError<ClientEmailConflict>()(
  'ClientEmailConflict',
  { code: Schema.Literal('client.email_conflict') },
  { httpApiStatus: 409 },
) {}

export class ClientCreationConflict extends Schema.TaggedError<ClientCreationConflict>()(
  'ClientCreationConflict',
  { code: Schema.Literal('client.creation_conflict') },
  { httpApiStatus: 409 },
) {}

export class ClientAccessNotFound extends Schema.TaggedError<ClientAccessNotFound>()(
  'ClientAccessNotFound',
  { code: Schema.Literal('client.access_not_found') },
  { httpApiStatus: 404 },
) {}

export const ClientFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  ClientNotFound,
  ClientArchived,
  ClientVersionConflict,
  ClientEmailConflict,
  ClientCreationConflict,
  ClientAccessNotFound,
  RequestRateLimited,
]);
export type ClientFailure = typeof ClientFailure.Type;
export type ClientFailureCode = ClientFailure['code'];
