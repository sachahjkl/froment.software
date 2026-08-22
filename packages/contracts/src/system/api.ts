import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/unstable/httpapi';

import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import {
  AuthenticationRateLimited,
  AuthenticationRejected,
  LoginRequest,
  SessionRejected,
  SessionStatus,
} from '../authentication/contracts.js';
import {
  BootstrapRateLimited,
  BootstrapRejected,
  BootstrapRequest,
  BootstrapResult,
  BootstrapStatus,
  BootstrapUnavailable,
} from '../bootstrap/contracts.js';
import { HealthStatus } from '../status/contracts.js';
import { DeploymentMetadata } from '../deployment/contracts.js';

export class SystemApi extends HttpApiGroup.make('system', { topLevel: true })
  .add(
    HttpApiEndpoint.get('health', '/api/health', { success: HealthStatus }),
    HttpApiEndpoint.get('version', '/api/version', { success: DeploymentMetadata }),
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
    HttpApiEndpoint.post('login', '/api/auth/login', {
      payload: LoginRequest,
      success: SessionStatus,
      error: [
        AuthenticationRejected.pipe(HttpApiSchema.status(401)),
        AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
      ],
    })
      .middleware(ApiRequestBody)
      .middleware(ApiBrowserRequest),
    HttpApiEndpoint.get('sessionStatus', '/api/auth/session', { success: SessionStatus }),
    HttpApiEndpoint.post('logout', '/api/auth/logout', {
      success: SessionStatus,
      error: SessionRejected.pipe(HttpApiSchema.status(401)),
    }).middleware(ApiBrowserRequest),
  )
  .annotate(OpenApi.Exclude, true) {}
