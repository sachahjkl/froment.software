import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/unstable/httpapi';

import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import {
  BootstrapRateLimited,
  BootstrapRejected,
  BootstrapRequest,
  BootstrapResult,
  BootstrapStatus,
  BootstrapUnavailable,
} from './contracts.js';

export class BootstrapApi extends HttpApiGroup.make('bootstrap', { topLevel: true })
  .add(
    HttpApiEndpoint.get('bootstrapStatus', '/api/bootstrap', { success: BootstrapStatus }),
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
      .middleware(ApiBrowserRequest),
  )
  .annotate(OpenApi.Exclude, true) {}
