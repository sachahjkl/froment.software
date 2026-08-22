import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/unstable/httpapi';

import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import {
  AuthenticationRateLimited,
  AuthenticationRejected,
  LoginRequest,
  SessionRejected,
  SessionStatus,
} from './contracts.js';

export class AuthenticationApi extends HttpApiGroup.make('authentication', { topLevel: true })
  .add(
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
