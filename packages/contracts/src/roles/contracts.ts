import { Schema } from 'effect';

import { PermissionCode } from '../permissions.js';
import { Ulid } from '../identifiers.js';

export const CustomRoleName = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(80));

export const CustomRole = Schema.Struct({
  id: Ulid,
  name: CustomRoleName,
  permissions: Schema.Array(PermissionCode).check(Schema.isUnique()),
  version: Schema.Int.check(Schema.isGreaterThan(0)),
  createdAt: Schema.Int,
  updatedAt: Schema.Int,
}).annotate({ identifier: 'CustomRole' });
export type CustomRole = typeof CustomRole.Type;

export const CustomRoleList = Schema.Array(CustomRole);

export const CustomRoleCreateRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  name: CustomRoleName,
  permissions: Schema.Array(PermissionCode).check(Schema.isUnique()),
}).annotate({ identifier: 'CustomRoleCreateRequest' });

export const CustomRoleUpdateRequest = Schema.Struct({
  name: CustomRoleName,
  permissions: Schema.Array(PermissionCode).check(Schema.isUnique()),
  expectedVersion: Schema.Int.check(Schema.isGreaterThan(0)),
}).annotate({ identifier: 'CustomRoleUpdateRequest' });

export class CustomRoleNotFound extends Schema.TaggedError<CustomRoleNotFound>()(
  'CustomRoleNotFound',
  { code: Schema.Literal('role.not_found') },
  { httpApiStatus: 404 },
) {}

export class CustomRoleConflict extends Schema.TaggedError<CustomRoleConflict>()(
  'CustomRoleConflict',
  {
    code: Schema.Literals([
      'role.name_exists',
      'role.creation_conflict',
      'role.version_conflict',
      'role.in_use',
    ]),
  },
  { httpApiStatus: 409 },
) {}

export const CustomRoleFailure = Schema.Union([CustomRoleNotFound, CustomRoleConflict]);
