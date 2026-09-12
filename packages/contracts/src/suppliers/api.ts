import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  SupplierArchived,
  SupplierCreateRequest,
  SupplierCreationConflict,
  SupplierList,
  SupplierNotFound,
  SupplierSummary,
  SupplierUpdateRequest,
  SupplierVersionConflict,
} from './contracts.js';

const commonErrors = [
  AuthenticationRequired.pipe(HttpApiSchema.status(401)),
  PermissionDenied.pipe(HttpApiSchema.status(403)),
] as const;

export class SuppliersApi extends HttpApiGroup.make('suppliers', { topLevel: true }).add(
  HttpApiEndpoint.get('supplierList', '/api/suppliers', {
    success: SupplierList,
    error: commonErrors,
  }).pipe(requirePermissions([Permissions.supplierRead]), authenticate),
  HttpApiEndpoint.get('supplierGet', '/api/suppliers/:supplierId', {
    params: { supplierId: Ulid },
    success: SupplierSummary,
    error: [...commonErrors, SupplierNotFound.pipe(HttpApiSchema.status(404))],
  }).pipe(requirePermissions([Permissions.supplierRead]), authenticate),
  HttpApiEndpoint.post('supplierCreate', '/api/suppliers', {
    payload: SupplierCreateRequest,
    success: SupplierSummary,
    error: [
      ...commonErrors,
      SupplierCreationConflict.pipe(HttpApiSchema.status(409)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.supplierCreate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
  HttpApiEndpoint.put('supplierUpdate', '/api/suppliers/:supplierId', {
    params: { supplierId: Ulid },
    payload: SupplierUpdateRequest,
    success: SupplierSummary,
    error: [
      ...commonErrors,
      SupplierNotFound.pipe(HttpApiSchema.status(404)),
      SupplierArchived.pipe(HttpApiSchema.status(409)),
      SupplierVersionConflict.pipe(HttpApiSchema.status(409)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.supplierUpdate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
  HttpApiEndpoint.post('supplierArchive', '/api/suppliers/:supplierId/archive', {
    params: { supplierId: Ulid },
    success: SupplierSummary,
    error: [
      ...commonErrors,
      SupplierNotFound.pipe(HttpApiSchema.status(404)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }).pipe(
    requirePermissions([Permissions.supplierArchive]),
    authenticate,
    rateLimit(RateLimits.sixtyPerMinute),
  ),
  HttpApiEndpoint.post('supplierReactivate', '/api/suppliers/:supplierId/reactivate', {
    params: { supplierId: Ulid },
    success: SupplierSummary,
    error: [
      ...commonErrors,
      SupplierNotFound.pipe(HttpApiSchema.status(404)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }).pipe(
    requirePermissions([Permissions.supplierArchive]),
    authenticate,
    rateLimit(RateLimits.sixtyPerMinute),
  ),
) {}
