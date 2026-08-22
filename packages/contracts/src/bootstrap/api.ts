import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  BootstrapRateLimited,
  BootstrapRejected,
  BootstrapRequest,
  BootstrapResult,
  BootstrapStatus,
  BootstrapUnavailable,
} from './contracts.js';

export class BootstrapApi extends HttpApiGroup.make('bootstrap', { topLevel: true }).add(
  HttpApiEndpoint.get('bootstrapStatus', '/api/bootstrap', {
    success: BootstrapStatus,
  }).pipe(frontendSpecific),
  HttpApiEndpoint.post('bootstrapCreate', '/api/bootstrap', {
    payload: BootstrapRequest,
    success: BootstrapResult,
    error: [
      BootstrapRejected.pipe(HttpApiSchema.status(401)),
      BootstrapUnavailable.pipe(HttpApiSchema.status(409)),
      BootstrapRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
) {}
