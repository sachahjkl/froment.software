import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRateLimited,
  AuthenticationRejected,
  LoginRequest,
  SessionRejected,
  SessionStatus,
} from './contracts.js';

export class AuthenticationApi extends HttpApiGroup.make('authentication', { topLevel: true }).add(
  HttpApiEndpoint.post('login', '/api/auth/login', {
    payload: LoginRequest,
    success: SessionStatus,
    error: [
      AuthenticationRejected.pipe(HttpApiSchema.status(401)),
      AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
  HttpApiEndpoint.get('sessionStatus', '/api/auth/session', {
    success: SessionStatus,
  }).pipe(frontendSpecific),
  HttpApiEndpoint.post('logout', '/api/auth/logout', {
    success: SessionStatus,
    error: SessionRejected.pipe(HttpApiSchema.status(401)),
  })
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
) {}
