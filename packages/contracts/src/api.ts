import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { HealthStatus } from './status.js';
import {
  AuthenticationRejected,
  AuthenticationRateLimited,
  LoginRequest,
  SessionRejected,
  SessionStatus,
} from './authentication.js';
import {
  BootstrapRejected,
  BootstrapRateLimited,
  BootstrapRequest,
  BootstrapResult,
  BootstrapStatus,
  BootstrapUnavailable,
} from './bootstrap.js';

export class SystemApi extends HttpApiGroup.make('system', { topLevel: true }).add(
  HttpApiEndpoint.get('health', '/api/health', {
    success: HealthStatus,
  }),
  HttpApiEndpoint.get('bootstrapStatus', '/api/bootstrap', {
    success: BootstrapStatus,
  }),
  HttpApiEndpoint.post('bootstrapCreate', '/api/bootstrap', {
    payload: BootstrapRequest,
    success: BootstrapResult,
    error: [
      BootstrapRejected.pipe(HttpApiSchema.status(401)),
      BootstrapUnavailable.pipe(HttpApiSchema.status(409)),
      BootstrapRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.post('login', '/api/auth/login', {
    payload: LoginRequest,
    success: SessionStatus,
    error: [
      AuthenticationRejected.pipe(HttpApiSchema.status(401)),
      AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.get('sessionStatus', '/api/auth/session', {
    success: SessionStatus,
  }),
  HttpApiEndpoint.post('logout', '/api/auth/logout', {
    success: SessionStatus,
    error: SessionRejected.pipe(HttpApiSchema.status(401)),
  }),
) {}

export class Api extends HttpApi.make('froment-api').add(SystemApi) {}
