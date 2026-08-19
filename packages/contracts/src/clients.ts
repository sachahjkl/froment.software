import { Schema } from 'effect';

import {
  AccessIdentifier,
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
} from './authentication.js';
import { Ulid } from './identifiers.js';

export const ClientSummary = Schema.Struct({
  id: Ulid,
  displayName: Schema.NonEmptyString,
  archived: Schema.Boolean,
});
export type ClientSummary = typeof ClientSummary.Type;

export const ClientList = Schema.Array(ClientSummary);
export type ClientList = typeof ClientList.Type;

export const ClientCreateRequest = Schema.Struct({
  displayName: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
});
export type ClientCreateRequest = typeof ClientCreateRequest.Type;

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

export const ClientFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  CsrfRejected,
  ClientNotFound,
  ClientArchived,
]);
export type ClientFailure = typeof ClientFailure.Type;
export type ClientFailureCode = ClientFailure['code'];
