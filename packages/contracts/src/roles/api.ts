import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import { Ulid } from '../identifiers.js';
import {
  CustomRole,
  CustomRoleCreateRequest,
  CustomRoleFailure,
  CustomRoleList,
  CustomRoleUpdateRequest,
} from './contracts.js';

export class RolesApi extends HttpApiGroup.make('roles', { topLevel: true }).add(
  HttpApiEndpoint.get('customRoleList', '/api/roles', {
    success: CustomRoleList,
    error: CustomRoleFailure.members,
  }).pipe(requirePermissions([Permissions.roleRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('customRoleGet', '/api/roles/:roleId', {
    params: { roleId: Ulid },
    success: CustomRole,
    error: CustomRoleFailure.members,
  }).pipe(requirePermissions([Permissions.roleRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('customRoleCreate', '/api/roles', {
    payload: CustomRoleCreateRequest,
    success: CustomRole,
    error: CustomRoleFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.roleManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('customRoleUpdate', '/api/roles/:roleId', {
    params: { roleId: Ulid },
    payload: CustomRoleUpdateRequest,
    success: CustomRole,
    error: CustomRoleFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.roleManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.delete('customRoleDelete', '/api/roles/:roleId', {
    params: { roleId: Ulid },
    success: HttpApiSchema.NoContent,
    error: CustomRoleFailure.members,
  }).pipe(requirePermissions([Permissions.roleManage]), authenticate, frontendSpecific),
) {}
