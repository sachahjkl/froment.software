import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  CatalogItem,
  CatalogItemCreateRequest,
  CatalogItemList,
  CatalogItemNotFound,
  CatalogItemUpdateRequest,
  CatalogItemVersionConflict,
} from './contracts.js';

export class CatalogApi extends HttpApiGroup.make('catalog', { topLevel: true }).add(
  HttpApiEndpoint.get('catalogList', '/api/catalog', {
    success: CatalogItemList,
    error: [AuthenticationRequired, PermissionDenied],
  }).pipe(requirePermissions([Permissions.quoteCreate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('catalogCreate', '/api/catalog', {
    payload: CatalogItemCreateRequest,
    success: CatalogItem,
    error: [AuthenticationRequired, PermissionDenied, RequestRateLimited],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.put('catalogUpdate', '/api/catalog/:itemId', {
    params: { itemId: Ulid },
    payload: CatalogItemUpdateRequest,
    success: CatalogItem,
    error: [
      AuthenticationRequired,
      PermissionDenied,
      RequestRateLimited,
      CatalogItemNotFound,
      CatalogItemVersionConflict,
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
