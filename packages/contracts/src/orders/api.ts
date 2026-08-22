import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { DocumentNotFound, QuotePreviewUnavailable } from '../documents/contracts.js';
import { Ulid } from '../identifiers.js';
import { OrderDocumentArtifact, OrderList, OrderNotFound } from '../orders/contracts.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';

export class OrdersApi extends HttpApiGroup.make('orders', { topLevel: true }).add(
  HttpApiEndpoint.get('orderList', '/api/orders', {
    success: OrderList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.orderRead]), authenticate),
  HttpApiEndpoint.get('orderPreview', '/api/orders/:orderId/preview', {
    params: { orderId: Ulid },
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/html; charset=utf-8' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      OrderNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(requirePermissions([Permissions.documentRender]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('orderPdfRender', '/api/orders/:orderId/pdf', {
    params: { orderId: Ulid },
    success: OrderDocumentArtifact,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      OrderNotFound.pipe(HttpApiSchema.status(404)),
      QuotePreviewUnavailable.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(
    requirePermissions([Permissions.documentRender]),
    authenticate,
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
  HttpApiEndpoint.get('orderPdfDownload', '/api/orders/:orderId/pdf', {
    params: { orderId: Ulid },
    success: Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array({ contentType: 'application/pdf' })),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      DocumentNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.documentDownload]), authenticate),
) {}
